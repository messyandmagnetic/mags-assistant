// /api/rpa/start.js
export default async function handler(req, res) {
  try {
    const token = process.env.BROWSERLESS_API_KEY || process.env.BROWSERLESS_TOKEN;
    const base  = process.env.BROWSERLESS_BASE || "https://production-sfo.browserless.io";
    if (!token) return res.status(500).json({ ok: false, error: "Missing BROWSERLESS token" });

    // 2 minutes; browserless accepts higher TTLs
    const ttlMs = Math.min(Number(req.query.ttl || 120000), 600000);
    const preloadUrl = (req.query.url || "").toString().trim();

    const args = ["--no-sandbox","--disable-dev-shm-usage"];
    if (preloadUrl) args.push(`--app=${preloadUrl}`);

    // create a session (token in query)
    const r = await fetch(`${base}/session?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: ttlMs, headless: false, stealth: true, args })
    });
    const text = await r.text();
    if (!r.ok) return res.status(r.status).json({ ok: false, error: text });

    const session = JSON.parse(text); // { connect: "wss://.../session/connect/...?...token=..." }
    const u = new URL(session.connect);

    // Build both viewer URL styles
    const wsParam  = `${u.host}${u.pathname}${u.search}`;       // host/path?token=...
    const wssParam = session.connect;                           // full wss://...&token=...

    const viewerUrl    = `${base}/devtools/inspector.html?ws=${encodeURIComponent(wsParam)}&token=${encodeURIComponent(token)}`;
    const viewerUrlAlt = `${base}/devtools/inspector.html?wss=${encodeURIComponent(wssParam)}&token=${encodeURIComponent(token)}`;

    return res.status(200).json({ ok: true, ttl: ttlMs, connect: session.connect, viewerUrl, viewerUrlAlt });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
