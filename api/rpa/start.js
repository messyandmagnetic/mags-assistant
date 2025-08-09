// api/rpa/start.js
export default async function handler(req, res) {
  try {
    const base =
      process.env.BROWSERLESS_BASE || 'https://production-sfo.browserless.io';
    const token =
      process.env.BROWSERLESS_TOKEN || process.env.BROWSERLESS_API_KEY;

    const ttlMs = Number(req.query.ttl || '45000');

    if (!token) {
      return res
        .status(500)
        .json({ ok: false, error: 'Missing BROWSERLESS_API_KEY/TOKEN' });
    }

    const url = `${base}/sessions?token=${encodeURIComponent(token)}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: ttlMs })
    });

    const text = await resp.text();
    if (!resp.ok) {
      return res.status(resp.status).json({ ok: false, error: text });
    }

    const data = JSON.parse(text); // { id, ttl, connect, viewerUrl }
    return res.status(200).json({ ok: true, ...data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
