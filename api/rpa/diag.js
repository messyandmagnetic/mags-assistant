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
  const keyPreview = key ? `${key.slice(0, 4)}…${key.slice(-4)}` : null;
  res.status(200).json({ ok: true, base, haveKey: Boolean(key), keyPreview });
}
