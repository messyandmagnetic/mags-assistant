// /api/rpa/viewer.js
export default async function handler(req, res) {
  try {
    const token = process.env.BROWSERLESS_API_KEY || process.env.BROWSERLESS_TOKEN;
    const base  = process.env.BROWSERLESS_BASE || "https://production-sfo.browserless.io";
    if (!token) {
      return res.status(500).json({ ok: false, error: "Missing BROWSERLESS token" });
    }

    // Create a new DevTools target (tab)
    // Use ?token= on the request so Browserless authorizes the creation
    const r = await fetch(`${base}/json/new?token=${encodeURIComponent(token)}`, { method: "PUT" });
    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ ok: false, error: data?.message || JSON.stringify(data) });
    }

    // data.devtoolsFrontendUrl looks like:
    //   /devtools/inspector.html?ws=production-sfo.browserless.io/devtools/page/<id>
    // or sometimes ...?wss=...
    let path = data.devtoolsFrontendUrl;
    if (!path) return res.status(500).json({ ok: false, error: "No devtoolsFrontendUrl in response" });

    // Build absolute URL
    // We'll put the token INSIDE the ws/wss param so DevTools can auth the websocket.
    const url = new URL(base + path);
    const hasWsParam = url.searchParams.has("ws");
    const hasWssParam = url.searchParams.has("wss");
    const key = hasWsParam ? "ws" : (hasWssParam ? "wss" : null);
    if (!key) {
      return res.status(500).json({ ok: false, error: "No ws/wss parameter in devtoolsFrontendUrl" });
    }

    // Get existing ws value and append token to that inner URL
    let wsVal = url.searchParams.get(key) || "";
    // If the inner ws already has a token, keep it; otherwise append
    if (!/(\?|&)token=/.test(wsVal)) {
      wsVal += (wsVal.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token);
    }
    url.searchParams.set(key, wsVal);

    // Return absolute, ready-to-click viewer URL
    return res.status(200).json({ ok: true, viewerUrl: url.toString() });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
