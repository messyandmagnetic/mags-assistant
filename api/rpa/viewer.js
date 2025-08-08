// /api/rpa/viewer.js
export default async function handler(req, res) {
  try {
    const token = process.env.BROWSERLESS_API_KEY || process.env.BROWSERLESS_TOKEN;
    const base  = process.env.BROWSERLESS_BASE || "https://production-sfo.browserless.io";
    if (!token) return res.status(500).json({ ok: false, error: "Missing BROWSERLESS token" });

    // 1) Create a new DevTools target (tab)
    const r = await fetch(`${base}/json/new?token=${encodeURIComponent(token)}`, { method: "PUT" });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ ok: false, error: data?.message || JSON.stringify(data) });

    // 2) Build a FULL viewer URL
    //    Browserless returns a path like: /devtools/inspector.html?ws=... or ?wss=...
    let path = data.devtoolsFrontendUrl;
    if (!path) return res.status(500).json({ ok: false, error: "No devtoolsFrontendUrl in response" });

    const url = new URL(base + path);

    // Find ws/wss param
    const hasWs  = url.searchParams.has("ws");
    const hasWss = url.searchParams.has("wss");
    const key = hasWs ? "ws" : (hasWss ? "wss" : null);
    if (!key) return res.status(500).json({ ok: false, error: "No ws/wss parameter in devtoolsFrontendUrl" });

    // Ensure TOKEN is in the *inner* ws URL
    let wsVal = url.searchParams.get(key) || "";
    if (!/(\?|&)token=/.test(wsVal)) {
      wsVal += (wsVal.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token);
    }
    url.searchParams.set(key, wsVal);

    // Also include token on the OUTER viewer URL (some gateways require it)
    if (!url.searchParams.has("token")) {
      url.searchParams.set("token", token);
    }

    const absoluteViewer = url.toString();

    // Optional redirect
    const shouldRedirect = String(req.query.redirect || "").toLowerCase() === "1"
                        || String(req.query.redirect || "").toLowerCase() === "true";

    if (shouldRedirect) {
      res.status(302).setHeader("Location", absoluteViewer);
      return res.end();
    }

    return res.status(200).json({ ok: true, viewerUrl: absoluteViewer });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
