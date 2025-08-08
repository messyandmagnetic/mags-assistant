// /api/rpa/start.js
export default async function handler(req, res) {
  try {
    const token = process.env.BROWSERLESS_API_KEY || process.env.BROWSERLESS_TOKEN;
    const base  = process.env.BROWSERLESS_BASE || "https://production-sfo.browserless.io";
    if (!token) return res.status(500).json({ ok: false, error: "Missing BROWSERLESS token" });

    const ttlMs = Math.min(Number(req.query.ttl || 15000), 60000);
    const preloadUrl = (req.query.url || "").toString().trim();

    const args = ["--no-sandbox","--disable-dev-shm-usage"];
    if (preloadUrl) args.push(`--app=${preloadUrl}`);

    // Create a new session (token via query param)
    const resp = await fetch(`${base}/session?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: ttlMs, headless: false, stealth: true, args })
    });

    const text = await resp.text();
    if (!resp.ok) return res.status(resp.status).json({ ok: false, error: text });

    const session = JSON.parse(text); // { connect: "wss://.../session/connect/...?...token=..." }
    const u = new URL(session.connect);
    const wsParam = `${u.host}${u.pathname}${u.search}`; // includes ?token= already

    // Build viewer URL – include token on the OUTER URL too, and use "wss" param
    const viewer = new URL(`${base}/devtools/inspector.html`);
    viewer.searchParams.set("wss", wsParam);
    viewer.searchParams.set("token", token);

    return res.status(200).json({
      ok: true,
      ttl: ttlMs,
      connect: session.connect,
      viewerUrl: viewer.toString()   // open this in a new tab
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
