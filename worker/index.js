// 사이트 전체 방문자 수 + 글별 조회수를 KV에 기록하는 최소 API.
//
// GET  /api/counter/site           -> 사이트 전체 카운트 +1 하고 현재 값 반환
// GET  /api/counter/post?slug=xxx  -> 해당 글 카운트 +1 하고 현재 값 반환
//
// wrangler.jsonc의 kv_namespaces에 COUNTERS 바인딩이 설정되어 있어야 동작한다.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // /api/counter/* 가 아니면 정적 파일(assets)로 그대로 넘긴다.
    if (!url.pathname.startsWith('/api/counter/')) {
      return env.ASSETS.fetch(request);
    }

    // 카운터 API는 GET만 허용
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let key;
    if (url.pathname === '/api/counter/site') {
      key = 'site:total';
    } else if (url.pathname === '/api/counter/post') {
      const slug = url.searchParams.get('slug');
      if (!slug) {
        return json({ error: 'slug query param required' }, 400);
      }
      key = `post:${slug}`;
    } else {
      return new Response('Not Found', { status: 404 });
    }

    const current = await env.COUNTERS.get(key);
    const next = (current ? parseInt(current, 10) : 0) + 1;
    await env.COUNTERS.put(key, String(next));

    return json({ count: next });
  },
};

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
