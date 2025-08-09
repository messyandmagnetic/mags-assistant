export default async function handler(req, res) {
  try {
    const base = process.env.BROWSERLESS_BASE || 'https://production-sfo.browserless.io';
    const key = process.env.BROWSERLESS_API_KEY || process.env.BROWSERLESS_TOKEN;
    if (!key) {
      return res.status(500).json({ ok: false, error: 'Missing BROWSERLESS_API_KEY or BROWSERLESS_TOKEN' });
    }

    let params = {};
    if (req.method === 'POST') {
      if (typeof req.body === 'string') {
        try { params = JSON.parse(req.body || '{}'); } catch { params = {}; }
      } else if (typeof req.body === 'object' && req.body !== null) {
        params = req.body;
      }
    } else {
      params = req.query || {};
    }

    let ttl = parseInt(params.ttl, 10);
    if (isNaN(ttl)) ttl = 45000;
    ttl = Math.min(ttl, 120000);

    const sessionUrl = params.url
      ? `${base}/sessions?url=${encodeURIComponent(params.url)}`
      : `${base}/sessions`;

    const resp = await fetch(sessionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: key, ttl }),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return res.status(resp.status).json({ ok: false, status: resp.status, error: data.error || data.message || 'Failed to start session' });
    }

    const connect = data.connect || data.ws || data.url || data.browserWSEndpoint;
    let viewerUrl = data.viewerUrl;
    if (!viewerUrl && connect) {
      viewerUrl = `${base}/devtools/inspector.html?ws=${encodeURIComponent(connect.replace('wss://',''))}&token=${encodeURIComponent(key)}`;
    }

    res.status(200).json({ ok: true, ttl, connect, viewerUrl });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
}
