export default async function handler(req, res) {
  try {
    const base  = process.env.BROWSERLESS_BASE || 'https://production-sfo.browserless.io';
    const token = process.env.BROWSERLESS_API_KEY || process.env.BROWSERLESS_TOKEN;
    if (!token) return res.status(500).json({ ok:false, error:'Missing BROWSERLESS_API_KEY' });

    const ttl = Number(req.query.ttl || 45000);
    const r = await fetch(`${base}/sessions?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(500).json({ ok:false, status:r.status, preview: JSON.stringify(j).slice(0,200) });

    res.status(200).json({ ok:true, ...j });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e) });
  }
}
