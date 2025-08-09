export default function handler(req, res) {
  const base = process.env.BROWSERLESS_BASE || 'https://production-sfo.browserless.io';
  const key  = process.env.BROWSERLESS_API_KEY || process.env.BROWSERLESS_TOKEN || '';
  res.status(200).json({ ok: true, base, haveKey: Boolean(key) });
}
