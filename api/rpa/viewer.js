// /api/rpa/viewer.js
export default async function handler(req, res) {
  try {
    const token = process.env.BROWSERLESS_API_KEY || process.env.BROWSERLESS_TOKEN;
    const base  = process.env.BROWSERLESS_BASE || "https://production-sfo.browserless.io";
    if (!token) return res.status(500).json({ ok: false, error: "Missing BROWSERLESS token" });

    // Create a brand-new blank page via the DevTools-compatible REST endpoint:
    // /json/new returns { devtoolsFrontendUrl, webSocketDebuggerUrl, ... }
    // We must append &token=... to the devtoolsFrontendUrl for access.
    const r = await fetch(`${base}/json/new?token=${encodeURIComponent(token)}`, { method: "PUT" });
    const data = await r.json();

    if (!r.ok) return res.status(r.status).json({ ok: false, error: data?.message || JSON.stringify(data) });

    let viewerUrl = data.devtoolsFrontendUrl;
    if (!viewerUrl) return res.status(500).json({ ok: false, error: "No devtoolsFrontendUrl in response" });

    if (!viewerUrl.includes("token=")) {
      const sep = viewerUrl.includes("?") ? "&" : "?";
      viewerUrl = `${viewerUrl}${sep}token=${encodeURIComponent(token)}`;
    }

    res.status(200).json({ ok: true, viewerUrl });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
