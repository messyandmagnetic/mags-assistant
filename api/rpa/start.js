import { validateEnv } from '../_lib/env.js';

validateEnv(['BROWSERLESS_BASE']);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ ok: false, error: 'Invalid JSON' });
    }
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    if (!url) {
      return res.status(400).json({ ok: false, error: 'Missing url' });
    }

    const base =
      process.env.BROWSERLESS_BASE || 'https://production-sfo.browserless.io';
    const token =
      process.env.BROWSERLESS_TOKEN || process.env.BROWSERLESS_API_KEY;
    const ttl =
      typeof body.ttl === 'number' && !isNaN(body.ttl)
        ? Math.min(body.ttl, 300000)
        : 45000;
    if (!token) {
      return res.status(200).json({ ok: true, url, stub: true });
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
        return res.status(r.status).json({ ok: false, error: text });
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
      return res
        .status(200)
        .json({ ok: true, url, viewerUrl, connect, ttl });
    } catch (err) {
      console.error('rpa/start', err);
      return res.status(200).json({ ok: true, url, stub: true });
    }
  } catch (err) {
    console.error('rpa/start parse', err);
    return res.status(500).json({ ok: false, error: 'Internal Server Error' });
  }
}

export const config = { runtime: 'nodejs20.x' };
