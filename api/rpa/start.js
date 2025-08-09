export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const token = process.env.BROWSERLESS_API_KEY || process.env.BROWSERLESS_TOKEN;
  if (!token) {
    res.status(500).json({ ok: false, error: 'Missing BROWSERLESS_API_KEY/TOKEN' });
    return;
  }

  const params = req.method === 'POST' ? (req.body || {}) : (req.query || {});

  const allowedKeys = ['url', 'ttl'];
  const unknown = Object.keys(params).find((k) => !allowedKeys.includes(k));
  if (unknown) {
    res.status(400).json({ ok: false, error: `Unknown field: ${unknown}` });
    return;
  }

  const url = params.url;
  let ttl = params.ttl;
  if (ttl === undefined || ttl === null || ttl === '') ttl = 300;
  ttl = Number(ttl);
  if (!Number.isInteger(ttl) || ttl < 30 || ttl > 3600) {
    res.status(400).json({ ok: false, error: 'Invalid ttl' });
    return;
  }

  const base = process.env.BROWSERLESS_BASE || 'https://production-sfo.browserless.io';
  const endpoint = `${base}/sessions?token=${encodeURIComponent(token)}`;

  const payload = { ttl };
  if (url) payload.url = url;

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const text = await resp.text();
    if (!resp.ok) {
      res.status(resp.status).json({ ok: false, error: text });
      return;
    }

    const data = JSON.parse(text);
    res
      .status(200)
      .json({ ok: true, viewerUrl: data.viewerUrl, connect: data.connect });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
}
