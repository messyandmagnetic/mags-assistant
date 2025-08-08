// /api/rpa/health.js
export default async function handler(req, res) {
  try {
    const token = process.env.BROWSERLESS_API_KEY || process.env.BROWSERLESS_TOKEN;
    const base  = process.env.BROWSERLESS_BASE || "https://production-sfo.browserless.io";
    if (!token) return res.status(500).json({ ok: false, error: "Missing BROWSERLESS token" });

    // Hit a simple REST endpoint with token (returns page HTML)
    const url = `${base}/content?token=${encodeURIComponent(token)}&url=${encodeURIComponent("https://example.com")}`;
    const r   = await fetch(url);
    const text = await r.text();

    res.status(200).json({
      ok: r.ok,
      status: r.status,
      base,
      preview: text.slice(0, 200)
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
