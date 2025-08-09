export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  const base =
    process.env.BROWSERLESS_BASE || 'https://production-sfo.browserless.io';
  const key =
    process.env.BROWSERLESS_TOKEN || process.env.BROWSERLESS_API_KEY || '';
  const url = `${base}/healthz?token=${key}`;
  try {
    const r = await fetch(url);
    if (r.ok) {
      res.status(200).json({ ok: true });
    } else {
      res.status(r.status).json({ ok: false, status: r.status });
    }
  } catch (err) {
    console.error('rpa/health', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
}
