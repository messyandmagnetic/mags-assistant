export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const ttl = Number(searchParams.get('ttl') || 45000);

  const base =
    process.env.BROWSERLESS_BASE || 'https://production-sfo.browserless.io';
  const token =
    process.env.BROWSERLESS_API_KEY || process.env.BROWSERLESS_TOKEN;

  if (!token) {
    return Response.json(
      { ok: false, error: 'Missing BROWSERLESS_API_KEY (or BROWSERLESS_TOKEN).' },
      { status: 500 }
    );
  }

  const res = await fetch(`${base}/sessions?token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ttl })
  });

  let data = {};
  try { data = await res.json(); } catch (_) {}

  if (!res.ok) {
    return Response.json(
      { ok: false, status: res.status, preview: JSON.stringify(data).slice(0, 200) },
      { status: 500 }
    );
  }

  return Response.json({ ok: true, ...data });
}
