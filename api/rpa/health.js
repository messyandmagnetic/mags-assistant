// /api/rpa/health.js
export default async function handler(req, res) {
  try {
    const token = process.env.BROWSERLESS_API_KEY || process.env.BROWSERLESS_TOKEN;
    const base  = process.env.BROWSERLESS_BASE || "https://production-sfo.browserless.io";
    if (!token) return res.status(500).json({ ok: false, error: "Missing BROWSERLESS token" });

    // Try to create a very short session (headless) just to prove auth works
    const r = await fetch(`${base}/session?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: 4000, headless: true })
    });

    const text = await r.text();
    if (!r.ok) return res.status(r.status).json({ ok: false, error: text, base });

    const session = JSON.parse(text); // { connect: "wss://.../session/connect/..." }
    return res.status(200).json({ ok: true, base, gotConnectUrl: !!session.connect });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
