const $ = (id) => document.getElementById(id);

async function start() {
  const input = $("targetUrl");
  const status = $("status");
  const url = (input.value || "").trim();
  if (!url) {
    status.textContent = "'url' is required";
    return;
  }
  status.textContent = "Starting…";
  try {
    const r = await fetch("/api/rpa/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });
    const data = await r.json();
    if (data.ok) {
      status.textContent = data.id ? `Started (id ${data.id})` : "Started";
    } else {
      const msg = [data.code, data.message || data.error, data.id && `(id ${data.id})`]
        .filter(Boolean)
        .join(" ");
      status.textContent = msg || "Error";
    }
  } catch (err) {
    status.textContent = err.message || String(err);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const input = $("targetUrl");
  const startBtn = $("startBtn");
  const params = new URLSearchParams(window.location.search);
  const url = params.get("url");
  input.value = url || "https://example.com";
  startBtn.addEventListener("click", start);
  if (url) startBtn.click();
});
