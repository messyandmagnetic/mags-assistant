export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    function corsHeaders() {
      return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://mags-assistant.vercel.app',
        'Access-Control-Allow-Headers': 'Content-Type, X-Fetch-Pass'
      };
    }

    function json(body, status = 200) {
      return new Response(JSON.stringify(body), {
        status,
        headers: corsHeaders()
      });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const needsAuth = (method, p) => method === 'POST' && p.startsWith('/api/');
    if (needsAuth(request.method, path) && env.FETCH_PASS) {
      const provided = request.headers.get('X-Fetch-Pass') || '';
      if (provided !== env.FETCH_PASS) {
        return json({ ok: false, error: 'unauthorized' }, 401);
      }
    }

    if (request.method === 'GET' && path === '/api/health') {
      return json({ ok: true, where: 'worker' });
    }

    if (request.method === 'POST' && path === '/api/stripe/sync-products') {
      return json({ ok: true, did: 'sync-stub' });
    }

    if (request.method === 'POST' && path === '/api/stripe/price-audit') {
      return json({ ok: true, did: 'audit-stub' });
    }

    return new Response('worker online', { status: 200, headers: corsHeaders() });
  }
};
