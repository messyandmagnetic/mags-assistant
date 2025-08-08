export default async function handler(req, res) {
  try {
    const token = process.env.BROWSERLESS_API_KEY || process.env.BROWSERLESS_TOKEN;
    const base  = process.env.BROWSERLESS_BASE || "https://production-sfo.browserless.io";
    if (!token) return res.status(500).json({ ok: false, error: "Missing BROWSERLESS token" });

    // hit the new base; many endpoints return text, so read as text safely
    const url = `${base}/?token=${encodeURIComponent(token)}`;
    const r   = await fetch(url, { method: "GET" });
    const ct  = r.headers.get("content-type") || "";
    const bodyText = await r.text();

    res.status(200).json({
      ok: r.ok,
      status: r.status,
      base,
      contentType: ct,
      preview: bodyText.slice(0, 200)
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
