export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }
  const body = req.body || {};
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url) {
    res.status(400).json({ ok: false, error: 'Missing url' });
    return;
  }
  const base =
    process.env.BROWSERLESS_BASE || 'https://production-sfo.browserless.io';
  const token =
    process.env.BROWSERLESS_TOKEN || process.env.BROWSERLESS_API_KEY;
  const ttl =
    typeof body.ttl === 'number' && !isNaN(body.ttl) ? body.ttl : 45000;
  if (!token) {
    res.status(200).json({ ok: true, url, stub: true });
    return;
  }
  try {
    const r = await fetch(`${base}/sessions?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl })
    });
    const text = await r.text();
    if (!r.ok) {
      console.error('rpa/start session error', r.status, text);
      res.status(r.status).json({ ok: false, error: text });
      return;
    }
    let session = {};
    try {
      session = JSON.parse(text);
    } catch (_) {}
    const id = session.id || session.sessionId;
    const connect =
      session.browserWSEndpoint || session.wsEndpoint || session.connect;
    const viewerUrl = id
      ? `${base}/playwright?token=${token}&sessionId=${id}&url=${encodeURIComponent(
          url
        )}`
      : undefined;
    res
      .status(200)
      .json({ ok: true, url, viewerUrl, connect, ttl });
  } catch (err) {
    console.error('rpa/start', err);
    res.status(200).json({ ok: true, url, stub: true });
  }
}
