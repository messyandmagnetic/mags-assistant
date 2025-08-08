export async function GET(req) {
  // simple alias to start-view (kept for convenience)
  const url = new URL(req.url);
  url.pathname = '/api/rpa/start-view';
  const res = await fetch(url, { method: 'GET', headers: {} });
  const body = await res.text();
  return new Response(body, { status: res.status, headers: { 'Content-Type': 'application/json' } });
}
