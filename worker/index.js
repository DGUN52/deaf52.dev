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
    // env.CONTENT_REPO: "owner/repo" 형식의 콘텐츠 저장소 이름 (wrangler.jsonc의 vars로 설정,
    // src/site.config.ts의 contentRepo와 동일한 값이어야 함 - Worker는 그 파일을 import할 수 없어
    // 별도 전달받는다).
    if (url.pathname === '/api/editor/posts' && request.method === 'GET') {
      if (!env.GITHUB_READ_TOKEN) {
        return json({ error: 'GITHUB_READ_TOKEN이 설정되지 않았습니다.' }, 500);
      }
      if (!env.CONTENT_REPO) {
        return json({ error: 'CONTENT_REPO가 설정되지 않았습니다 (wrangler.jsonc의 vars 확인).' }, 500);
      }

      const category = url.searchParams.get('category');
      const slug = url.searchParams.get('slug');

      if (!category || !['it', 'humanities'].includes(category)) {
        return json({ error: 'category는 it 또는 humanities여야 합니다.' }, 400);
      }

      const REPO = env.CONTENT_REPO;

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

      // slug가 없으면 ko 폴더의 글 목록을 반환한다.
      // 예전엔 파일명만 모아서 .sort()(알파벳순)로 반환했는데, 에디터의 "기존 글 불러오기"
      // 셀렉트와 북마크 삽입 모달 둘 다 이 알파벳순 그대로를 썼다 - 최신 글을 찾기 불편했다.
      // 이제는 각 .md 파일의 frontmatter(publishedAt, title)까지 같이 내려줘서
      // 클라이언트가 최신순으로 보여줄 수 있게 한다.
      //
      // GitHub Contents API로 디렉토리를 조회하면 파일 목록(이름)만 오고 내용은 안 온다 -
      // 정렬 기준이 되는 publishedAt을 얻으려면 파일마다 별도 요청이 필요하다(N개 파일 =
      // N개 요청, 병렬화해도 요청 횟수 자체는 줄지 않음). 게다가 북마크 모달을 열 때마다,
      // 글 내용이 바뀌지도 않았는데 매번 전체를 다시 훑는 건 낭비다 - content 레포는
      // 관리자가 직접 글을 쓸 때만 바뀌고, 그 사이엔 목록이 그대로다.
      // 그래서 KV(COUNTERS, 조회수 카운터와 같은 네임스페이스 재사용)에
      // "editor-posts-cache:{category}" 키로 정렬된 결과를 캐싱해두고, 캐시가 있으면
      // 무조건 그걸 쓴다 - 시간 기반 TTL은 두지 않는다. 이 캐시가 "오래됐는지"는
      // 시간이 아니라 "글 내용이 실제로 바뀌었는지"로 판단해야 의미가 있는데, 그건
      // 결국 관리자가 직접 push한 순간을 아는 것과 같다. 즉 TTL로 몇 분마다 자동으로
      // 다시 확인해봐야 대부분은 "안 바뀜"이라 GitHub API만 낭비하고, 반대로 push한
      // 지 1분 만에 바로 반영하고 싶어도 TTL이 남아있으면 못 본다 - 시간으로 캐시
      // 신선도를 추정하는 게 애초에 안 맞는 경우. 그래서 무효화는 오직 관리자가
      // "⟳ 목록 새로고침" 버튼을 눌러 보내는 ?refresh=1로만 한다(수동 무효화).
      const cacheKey = `editor-posts-cache:${category}`;
      const forceRefresh = url.searchParams.get('refresh') === '1';

      if (!forceRefresh) {
        const cachedRaw = await env.COUNTERS.get(cacheKey);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          return json({ category, items: cached.items, cached: true });
        }
      }

      const dirPath = `${category}/ko`;
      const dirRes = await fetch(
        `https://api.github.com/repos/${REPO}/contents/${dirPath}`,
        {
          headers: {
            Authorization: `Bearer ${env.GITHUB_READ_TOKEN}`,
            'User-Agent': 'deaf52-admin-editor',
            Accept: 'application/vnd.github+json',
          },
        }
      );
      if (!dirRes.ok) {
        return json({ error: `GitHub API 오류 (${dirRes.status})` }, dirRes.status === 404 ? 404 : 502);
      }
      const files = await dirRes.json();
      const slugs = (Array.isArray(files) ? files : [])
        .filter((f) => f.type === 'file' && f.name.endsWith('.md'))
        .map((f) => f.name.replace(/\.md$/, ''));

      // frontmatter에서 필요한 필드(title, publishedAt)만 뽑는 아주 단순한 파서.
      // editor.astro의 parseFrontmatter()와 동일한 수준(중첩 YAML 등은 지원 안 함) -
      // 이 프로젝트 frontmatter 스키마 정도만 다루면 충분하다.
      function extractField(raw, field) {
        const line = raw.split('\n').find((l) => l.startsWith(`${field}:`));
        if (!line) return '';
        return line.slice(field.length + 1).trim().replace(/^["']|["']$/g, '');
      }

      const items = await Promise.all(
        slugs.map(async (slug) => {
          try {
            const fileRes = await fetch(
              `https://api.github.com/repos/${REPO}/contents/${dirPath}/${slug}.md`,
              {
                headers: {
                  Authorization: `Bearer ${env.GITHUB_READ_TOKEN}`,
                  'User-Agent': 'deaf52-admin-editor',
                  Accept: 'application/vnd.github.raw+json',
                },
              }
            );
            if (!fileRes.ok) return { slug, title: slug, publishedAt: null };
            const raw = await fileRes.text();
            return {
              slug,
              title: extractField(raw, 'title') || slug,
              publishedAt: extractField(raw, 'publishedAt') || null,
            };
          } catch {
            // 개별 파일 조회가 실패해도 나머지 목록은 계속 내려준다 - 이 글은 정렬 기준이
            // 없는 것으로 취급해 맨 뒤로 보낸다(아래 정렬 로직).
            return { slug, title: slug, publishedAt: null };
          }
        })
      );

      items.sort((a, b) => {
        if (!a.publishedAt && !b.publishedAt) return a.slug.localeCompare(b.slug);
        if (!a.publishedAt) return 1;
        if (!b.publishedAt) return -1;
        return new Date(b.publishedAt).valueOf() - new Date(a.publishedAt).valueOf();
      });

      // 다음 요청부터는 (관리자가 새로고침을 누르기 전까지) 위 캐시 히트 경로를 타도록
      // KV에 저장. 시간 TTL이 없으므로 이 캐시는 ?refresh=1이 다시 올 때까지 계속 쓰인다.
      try {
        await env.COUNTERS.put(cacheKey, JSON.stringify({ items }));
      } catch {
        // 캐시 저장 실패는 무시 - 다음 요청이 다시 GitHub API를 타는 것으로 충분하다.
      }

      return json({ category, items, cached: false });
    }

    // ---------- 관리자: 이미지 목록 (content 저장소 public/images/) ----------
    // 에디터에서 heroImage/본문 이미지 삽입 시 파일명을 직접 타이핑하지 않고
    // 이미 업로드된 파일 중에서 고를 수 있도록, GitHub API로 디렉토리 목록만 읽어온다.
    if (url.pathname === '/api/editor/images' && request.method === 'GET') {
      if (!env.GITHUB_READ_TOKEN) {
        return json({ error: 'GITHUB_READ_TOKEN이 설정되지 않았습니다.' }, 500);
      }
      if (!env.CONTENT_REPO) {
        return json({ error: 'CONTENT_REPO가 설정되지 않았습니다 (wrangler.jsonc의 vars 확인).' }, 500);
      }
      const REPO = env.CONTENT_REPO;
      const res = await fetch(`https://api.github.com/repos/${REPO}/contents/public/images`, {
        headers: {
          Authorization: `Bearer ${env.GITHUB_READ_TOKEN}`,
          'User-Agent': 'deaf52-admin-editor',
          Accept: 'application/vnd.github+json',
        },
      });
      if (!res.ok) {
        return json({ error: `GitHub API 오류 (${res.status})` }, res.status === 404 ? 404 : 502);
      }
      const files = await res.json();
      const items = (Array.isArray(files) ? files : [])
        .filter((f) => f.type === 'file' && /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name))
        .map((f) => f.name)
        .sort();
      return json({ items });
    }

    // ---------- 관리자: 기술 태그(tech) 목록 ----------
    // 매번 IT 글 전체를 GitHub에서 훑는 건 무거우므로, KV에 캐시해두고 그걸 읽기만 한다.
    // 캐시는 실시간 자동 갱신이 아니라 관리자가 에디터에서 "태그 목록 갱신" 버튼을 눌렀을 때만
    // /api/editor/tags/refresh 가 GitHub 전체를 스캔해서 KV(키: "editor:tags")를 다시 채운다.
    if (url.pathname === '/api/editor/tags' && request.method === 'GET') {
      const raw = await env.COUNTERS.get('editor:tags');
      return json({ items: raw ? JSON.parse(raw) : [] });
    }

    if (url.pathname === '/api/editor/tags/refresh' && request.method === 'POST') {
      if (!env.GITHUB_READ_TOKEN) {
        return json({ error: 'GITHUB_READ_TOKEN이 설정되지 않았습니다.' }, 500);
      }
      if (!env.CONTENT_REPO) {
        return json({ error: 'CONTENT_REPO가 설정되지 않았습니다 (wrangler.jsonc의 vars 확인).' }, 500);
      }
      const REPO = env.CONTENT_REPO;
      const listRes = await fetch(`https://api.github.com/repos/${REPO}/contents/it/ko`, {
        headers: {
          Authorization: `Bearer ${env.GITHUB_READ_TOKEN}`,
          'User-Agent': 'deaf52-admin-editor',
          Accept: 'application/vnd.github+json',
        },
      });
      if (!listRes.ok) {
        return json({ error: `GitHub API 오류 (${listRes.status})` }, listRes.status === 404 ? 404 : 502);
      }
      const files = await listRes.json();
      const mdFiles = (Array.isArray(files) ? files : []).filter(
        (f) => f.type === 'file' && f.name.endsWith('.md')
      );

      const tagSet = new Set();
      // GitHub REST API rate limit(토큰당 시간당 5000회) 안에서 순차 처리 - 글 개수가
      // 수백 개 단위로 늘어나기 전까지는 병렬화 없이도 충분히 빠르다.
      for (const f of mdFiles) {
        const fileRes = await fetch(
          `https://api.github.com/repos/${REPO}/contents/it/ko/${f.name}`,
          {
            headers: {
              Authorization: `Bearer ${env.GITHUB_READ_TOKEN}`,
              'User-Agent': 'deaf52-admin-editor',
              Accept: 'application/vnd.github.raw+json',
            },
          }
        );
        if (!fileRes.ok) continue;
        const content = await fileRes.text();
        const match = content.match(/^tech:\s*\[(.*)\]\s*$/m);
        if (!match) continue;
        match[1]
          .split(',')
          .map((t) => t.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean)
          .forEach((t) => tagSet.add(t));
      }

      const items = [...tagSet].sort((a, b) => a.localeCompare(b));
      await env.COUNTERS.put('editor:tags', JSON.stringify(items));
      return json({ items });
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
