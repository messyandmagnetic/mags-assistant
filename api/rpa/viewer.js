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
// --- Mags Live Viewer mini UI ---
document.addEventListener("DOMContentLoaded", () => {
  // Create a simple floating bar
  const bar = document.createElement("div");
  bar.id = "mags-live-bar";
  bar.style.cssText = `
    position: fixed; right: 16px; bottom: 16px; z-index: 9999;
    display: flex; gap: 8px; align-items: center; 
    background: rgba(0,0,0,.6); color: #fff; padding: 10px 12px; border-radius: 10px;
    backdrop-filter: blur(4px); font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  `;

  const openBtn = document.createElement("button");
  openBtn.textContent = "Watch Mags";
  openBtn.style.cssText = "padding:6px 10px;border-radius:8px;border:none;cursor:pointer;background:#10b981;color:#fff;";
  openBtn.addEventListener("click", async () => {
    try {
      // redirect=1 so you don’t have to copy any URL
      window.open("/api/rpa/viewer?redirect=1", "_blank");
    } catch (e) {
      alert("Couldn’t open viewer: " + e.message);
    }
  });

  const urlInput = document.createElement("input");
  urlInput.type = "text";
  urlInput.placeholder = "https://dashboard.stripe.com/login";
  urlInput.style.cssText = "width:320px;padding:6px 8px;border-radius:8px;border:1px solid #333;background:#111;color:#fff;";

  const openWithUrlBtn = document.createElement("button");
  openWithUrlBtn.textContent = "Watch + Open URL";
  openWithUrlBtn.style.cssText = "padding:6px 10px;border-radius:8px;border:none;cursor:pointer;background:#3b82f6;color:#fff;";
  openWithUrlBtn.addEventListener("click", async () => {
    let u = urlInput.value.trim();
    if (!u) u = "https://dashboard.stripe.com/login";
    // Use the session starter that supports ?url= to preload the page
    const r = await fetch(`/api/rpa/start?ttl=45000&url=${encodeURIComponent(u)}`);
    const data = await r.json();
    if (!data.ok) {
      alert(data.error || "Could not start session");
      return;
    }
    window.open(data.viewerUrl, "_blank");
  });

  bar.appendChild(openBtn);
  bar.appendChild(urlInput);
  bar.appendChild(openWithUrlBtn);
  document.body.appendChild(bar);
});
