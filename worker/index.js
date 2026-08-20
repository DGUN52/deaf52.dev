// 사이트 전체 방문자 수 + 글별 조회수/좋아요를 KV에 기록하는 최소 API.
//
// GET  /api/counter/site           -> 사이트 전체 카운트 +1 하고 현재 값 반환
// GET  /api/counter/post?slug=xxx  -> 해당 글 조회수 +1 하고 현재 값 반환
// GET  /api/like/post?slug=xxx     -> 해당 글 좋아요 수 조회 (증감 없음)
// POST /api/like/post?slug=xxx     -> 해당 글 좋아요 토글 (클라이언트가 보낸 liked 여부에 따라 +1/-1)
//
// wrangler.jsonc의 kv_namespaces에 COUNTERS 바인딩이 설정되어 있어야 동작한다.
// 좋아요는 "누가 눌렀는지"를 서버에 저장하지 않는다 (로그인 시스템이 없으므로).
// 클라이언트(브라우저 localStorage)가 "내가 눌렀는지"를 기억하고, 그 상태에 따라 +1/-1을 요청한다.
// 즉 어뷰징(새로고침 연타로 무한 증가) 방지는 클라이언트 신뢰에 의존하는 단순한 방식이다.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (
      !url.pathname.startsWith('/api/counter/') &&
      !url.pathname.startsWith('/api/like/')
    ) {
      return env.ASSETS.fetch(request);
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

    // ---------- 좋아요 (신규) ----------
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
