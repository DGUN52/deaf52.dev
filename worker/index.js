// 사이트 전체 방문자 수 + 글별 조회수/좋아요 + 번역 신고를 KV에 기록하는 최소 API.
//
// GET  /api/counter/site           -> 사이트 전체 카운트 +1 하고 현재 값 반환
// GET  /api/counter/post?slug=xxx  -> 해당 글 조회수 +1 하고 현재 값 반환
// GET  /api/like/post?slug=xxx     -> 해당 글 좋아요 수 조회 (증감 없음)
// POST /api/like/post?slug=xxx     -> 해당 글 좋아요 토글 (클라이언트가 보낸 liked 여부에 따라 +1/-1)
// POST /api/report/translation     -> 번역 신고 접수 (body: { slug, lang, issueType, section?, comment? })
// GET  /api/ranking?metric=views|likes&limit=5  -> 조회수/좋아요 상위 글 목록 (slug, count)
// GET   /api/admin/reports              -> 번역 신고 전체 목록 (최신순)
// PATCH /api/admin/reports?key=xxx      -> 신고 처리 상태 토글 (body: { status: 'open' | 'resolved' })
//   ※ 관리자 API는 인증 로직을 자체적으로 두지 않는다. Cloudflare Access로 /admin/* 경로 자체를
//     이메일 인증 보호하는 것을 전제로 하며, 이 API는 그 뒤에서만 호출된다.
//
// wrangler.jsonc의 kv_namespaces에 COUNTERS 바인딩이 설정되어 있어야 동작한다.
// 좋아요는 "누가 눌렀는지"를 서버에 저장하지 않는다 (로그인 시스템이 없으므로).
// 클라이언트(브라우저 localStorage)가 "내가 눌렀는지"를 기억하고, 그 상태에 따라 +1/-1을 요청한다.
// 즉 어뷰징(새로고침 연타로 무한 증가) 방지는 클라이언트 신뢰에 의존하는 단순한 방식이다.
//
// 번역 신고는 KV에 "report:{timestamp}:{random}" 키로 각각 저장되며(리스트 형태),
// 관리자가 나중에 KV 목록을 훑어서 확인하는 방식이다 (별도 관리자 UI는 아직 없음).
//
// 쿠키 동의(Consent Mode) 지역별 기본값을 위해, HTML 응답에는 Cloudflare가 요청마다
// 정확히 알려주는 방문자 국가 코드(request.cf.country)를 <head> 맨 앞에 인라인 스크립트로
// 심어준다. 클라이언트(BaseLayout의 consent 기본값 스크립트)가 이 값을 읽어서
// GDPR/EEA 권역 방문자에게만 기본값을 "거부"로 적용한다.

class CountryInjector {
  constructor(country) {
    this.country = country;
  }
  element(el) {
    el.prepend(
      `<script>window.__CF_COUNTRY__=${JSON.stringify(this.country || '')};</script>`,
      { html: true }
    );
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (
      !url.pathname.startsWith('/api/counter/') &&
      !url.pathname.startsWith('/api/like/') &&
      !url.pathname.startsWith('/api/report/') &&
      !url.pathname.startsWith('/api/ranking') &&
      !url.pathname.startsWith('/api/admin/') &&
      !url.pathname.startsWith('/api/editor/')
    ) {
      const response = await env.ASSETS.fetch(request);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) return response;

      const country = request.cf && request.cf.country; // 예: "DE", "KR" (알 수 없으면 undefined)
      return new HTMLRewriter().on('head', new CountryInjector(country)).transform(response);
    }

    // ---------- 조회수 (기존) ----------
    if (url.pathname === '/api/counter/site' && request.method === 'GET') {
      const count = await incrementKV(env, 'site:total');
      return json({ count });
    }

    if (url.pathname === '/api/counter/post' && request.method === 'GET') {
      const slug = url.searchParams.get('slug');
      if (!slug) return json({ error: 'slug query param required' }, 400);
      const count = await incrementKV(env, `post:${slug}`);
      return json({ count });
    }

    // ---------- 좋아요 (기존) ----------
    if (url.pathname === '/api/like/post') {
      const slug = url.searchParams.get('slug');
      if (!slug) return json({ error: 'slug query param required' }, 400);
      const key = `like:${slug}`;

      if (request.method === 'GET') {
        const current = await env.COUNTERS.get(key);
        return json({ count: current ? parseInt(current, 10) : 0 });
      }

      if (request.method === 'POST') {
        let body;
        try {
          body = await request.json();
        } catch {
          return json({ error: 'invalid JSON body' }, 400);
        }
        const delta = body.liked ? 1 : -1;

        const current = await env.COUNTERS.get(key);
        const next = Math.max(0, (current ? parseInt(current, 10) : 0) + delta);
        await env.COUNTERS.put(key, String(next));
        return json({ count: next });
      }

      return new Response('Method Not Allowed', { status: 405 });
    }

    // ---------- 번역 신고 (신규) ----------
    if (url.pathname === '/api/report/translation' && request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'invalid JSON body' }, 400);
      }

      const { slug, lang, issueType, section, comment } = body;
      if (!slug || !lang || !issueType) {
        return json({ error: 'slug, lang, issueType are required' }, 400);
      }

      const ALLOWED_ISSUE_TYPES = ['hard-to-understand', 'not-translated', 'wrong-meaning', 'typo', 'other'];
      if (!ALLOWED_ISSUE_TYPES.includes(issueType)) {
        return json({ error: 'invalid issueType' }, 400);
      }

      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).slice(2, 8);
      const key = `report:${timestamp}:${randomSuffix}`;

      const record = {
        slug: String(slug).slice(0, 200),
        lang: String(lang).slice(0, 10),
        issueType,
        section: section ? String(section).slice(0, 200) : null,
        comment: comment ? String(comment).slice(0, 1000) : null,
        createdAt: new Date(timestamp).toISOString(),
        status: 'open', // 관리자 페이지에서 확인 처리하면 'resolved'로 바뀜
      };

      await env.COUNTERS.put(key, JSON.stringify(record));

      return json({ ok: true });
    }

    // ---------- 관리자: 번역 신고 조회/처리 (신규) ----------
    // 인증은 Cloudflare Access가 /admin/* 경로에서 처리한다는 전제.
    if (url.pathname === '/api/admin/reports') {
      if (request.method === 'GET') {
        const list = await env.COUNTERS.list({ prefix: 'report:' });
        const items = await Promise.all(
          list.keys.map(async (k) => {
            const raw = await env.COUNTERS.get(k.name);
            if (!raw) return null;
            let record;
            try {
              record = JSON.parse(raw);
            } catch {
              return null;
            }
            return { key: k.name, status: 'open', ...record };
          })
        );
        const cleaned = items
          .filter(Boolean)
          .sort((a, b) => (a.key < b.key ? 1 : -1)); // key에 타임스탬프가 포함되어 있어 최신순 정렬됨

        return json({ items: cleaned });
      }

      if (request.method === 'PATCH') {
        const key = url.searchParams.get('key');
        if (!key || !key.startsWith('report:')) {
          return json({ error: 'valid key query param required' }, 400);
        }
        let body;
        try {
          body = await request.json();
        } catch {
          return json({ error: 'invalid JSON body' }, 400);
        }
        if (body.status !== 'open' && body.status !== 'resolved') {
          return json({ error: 'status must be "open" or "resolved"' }, 400);
        }

        const raw = await env.COUNTERS.get(key);
        if (!raw) return json({ error: 'report not found' }, 404);

        let record;
        try {
          record = JSON.parse(raw);
        } catch {
          return json({ error: 'stored report is corrupted' }, 500);
        }

        record.status = body.status;
        await env.COUNTERS.put(key, JSON.stringify(record));

        return json({ ok: true, item: { key, ...record } });
      }

      return new Response('Method Not Allowed', { status: 405 });
    }

    // ---------- 관리자: md 에디터용 글 목록/조회 (신규, 읽기 전용) ----------
    // GitHub API로 content 저장소(private repo)의 it/ko, humanities/ko 아래 .md 파일을 읽어온다.
    // 이 API는 목록/조회만 제공하고 저장(쓰기)은 하지 않는다 - 저장은 관리자 페이지에서
    // .md 파일을 직접 다운로드해서 로컬 content 폴더에 옮기고 git commit/push하는 방식.
    // env.GITHUB_READ_TOKEN: content 저장소에 대한 Contents:Read-only 권한의
    // GitHub Fine-grained token (Worker Secret으로 별도 등록 필요, 빌드용 CONTENT_REPO_TOKEN과는 별개).
    if (url.pathname === '/api/editor/posts' && request.method === 'GET') {
      if (!env.GITHUB_READ_TOKEN) {
        return json({ error: 'GITHUB_READ_TOKEN이 설정되지 않았습니다.' }, 500);
      }

      const category = url.searchParams.get('category');
      const slug = url.searchParams.get('slug');

      if (!category || !['it', 'humanities'].includes(category)) {
        return json({ error: 'category는 it 또는 humanities여야 합니다.' }, 400);
      }

      const REPO = 'DGUN52/deaf52.dev-content';

      // slug가 있으면 해당 글(ko 원본) 내용을 읽어서 반환
      if (slug) {
        const filePath = `${category}/ko/${slug}.md`;
        const res = await fetch(
          `https://api.github.com/repos/${REPO}/contents/${filePath}`,
          {
            headers: {
              Authorization: `Bearer ${env.GITHUB_READ_TOKEN}`,
              'User-Agent': 'deaf52-admin-editor',
              Accept: 'application/vnd.github.raw+json',
            },
          }
        );
        if (!res.ok) {
          return json({ error: `GitHub API 오류 (${res.status})` }, res.status === 404 ? 404 : 502);
        }
        const content = await res.text();
        return json({ slug, category, content });
      }

      // slug가 없으면 ko 폴더의 글 목록(파일명만)을 반환
      const dirPath = `${category}/ko`;
      const res = await fetch(
        `https://api.github.com/repos/${REPO}/contents/${dirPath}`,
        {
          headers: {
            Authorization: `Bearer ${env.GITHUB_READ_TOKEN}`,
            'User-Agent': 'deaf52-admin-editor',
            Accept: 'application/vnd.github+json',
          },
        }
      );
      if (!res.ok) {
        return json({ error: `GitHub API 오류 (${res.status})` }, res.status === 404 ? 404 : 502);
      }
      const files = await res.json();
      const items = (Array.isArray(files) ? files : [])
        .filter((f) => f.type === 'file' && f.name.endsWith('.md'))
        .map((f) => f.name.replace(/\.md$/, ''))
        .sort();

      return json({ category, items });
    }

    // ---------- 인기글 랭킹 (신규) ----------
    if (url.pathname === '/api/ranking' && request.method === 'GET') {
      const metric = url.searchParams.get('metric') === 'likes' ? 'like' : 'post';
      const limit = Math.min(20, parseInt(url.searchParams.get('limit') || '5', 10) || 5);

      const prefix = `${metric}:`;
      const list = await env.COUNTERS.list({ prefix });

      const entries = await Promise.all(
        list.keys.map(async (k) => {
          const value = await env.COUNTERS.get(k.name);
          return {
            slug: k.name.slice(prefix.length),
            count: value ? parseInt(value, 10) : 0,
          };
        })
      );

      entries.sort((a, b) => b.count - a.count);

      return json({ items: entries.slice(0, limit) });
    }

    return new Response('Not Found', { status: 404 });
  },
};

async function incrementKV(env, key) {
  const current = await env.COUNTERS.get(key);
  const next = (current ? parseInt(current, 10) : 0) + 1;
  await env.COUNTERS.put(key, String(next));
  return next;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
