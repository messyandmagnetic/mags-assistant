export default async function handler(req, res) {
  const key = process.env.BROWSERLESS_API_KEY;
  const base = process.env.BROWSERLESS_BASE || 'https://production-sfo.browserless.io';

  if (!key) {
    return res.status(400).json({ ok: false, error: 'Missing BROWSERLESS_API_KEY' });
  }

  const urlParam = req.query.url ? String(req.query.url) : undefined;
  const ttlMs = Number(req.query.ttl || '45000');

  try {
    const resp = await fetch(`${base}/sessions?token=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ttl: ttlMs,
        ...(urlParam ? { url: urlParam } : {})
      })
    });

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(502).json({ ok: false, error: text });
    }

    const data = await resp.json();
    const { viewerUrl, connect } = data;
    return res.status(200).json({ ok: true, viewerUrl, connect });
  } catch (err) {
    return res.status(502).json({ ok: false, error: String(err) });
  }
}
