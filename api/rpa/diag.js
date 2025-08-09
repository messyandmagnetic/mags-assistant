export default async function handler(req, res) {
  try {
    const base = process.env.BROWSERLESS_BASE || 'https://production-sfo.browserless.io';
    const key  = process.env.BROWSERLESS_API_KEY || process.env.BROWSERLESS_TOKEN || '';
    res.status(200).json({
      ok: true,
      base,
      haveKey: Boolean(key),
      keyPreview: key ? `${key.slice(0,4)}…${key.slice(-4)} (${key.length})` : null,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
}
