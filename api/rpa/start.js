// /api/rpa/start.js
export default async function handler(req, res) {
  try {
    const token = process.env.BROWSERLESS_API_KEY || process.env.BROWSERLESS_TOKEN;
    const base  = process.env.BROWSERLESS_BASE || "https://production-sfo.browserless.io";
    if (!token) return res.status(500).json({ ok: false, error: "Missing BROWSERLESS token" });

    const ttlMs = Math.min(Number(req.query.ttl || 15000), 60000);
    const url   = (req.query.url || "").toString().trim();
    const args  = ["--no-sandbox","--disable-dev-shm-usage"];
    if (url) args.push(`--app=${url}`);

    const r = await fetch(`${base}/session?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: ttlMs, headless: false, stealth: true, args })
    });

    const text = await r.text();
    if (!r.ok) return res.status(r.status).json({ ok: false, error: text });

    const session = JSON.parse(text); // { connect: "wss://.../session/connect/..." }
    const u = new URL(session.connect);
    const wsParam = `${u.host}${u.pathname}${u.search}`;
    const viewerUrl = `${base}/devtools/inspector.html?ws=${encodeURIComponent(wsParam)}`;

    return res.status(200).json({ ok: true, ttl: ttlMs, viewerUrl, connect: session.connect });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
