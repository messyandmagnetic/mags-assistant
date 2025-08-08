// /api/rpa/health.js
export default async function handler(req, res) {
  try {
    const token = process.env.BROWSERLESS_API_KEY || process.env.BROWSERLESS_TOKEN;
    if (!token) return res.status(500).json({ ok: false, error: "Missing BROWSERLESS token" });

    const r = await fetch(`https://chrome.browserless.io/metrics?token=${encodeURIComponent(token)}`);
    const text = await r.text(); // metrics is plain text, not JSON

    return res.status(200).json({
      ok: r.ok,
      status: r.status,
      contentType: r.headers.get("content-type"),
      preview: text.slice(0, 160) // show first 160 chars
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
