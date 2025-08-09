export default async function handler(req, res) {
  try {
    const base = process.env.BROWSERLESS_BASE || 'https://production-sfo.browserless.io';
    const key = process.env.BROWSERLESS_API_KEY || process.env.BROWSERLESS_TOKEN || '';
    const healthUrl = `${base}/healthz?token=${encodeURIComponent(key)}`;
    let r = await fetch(healthUrl);
    if (!r.ok) {
      r = await fetch(`${base}/content?token=${encodeURIComponent(key)}`);
    }
    if (r.ok) {
      res.status(200).json({ ok: true });
    } else {
      res.status(r.status).json({ ok: false, status: r.status });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
}
