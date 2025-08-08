document.addEventListener("DOMContentLoaded", function () {
  const form = document.querySelector("form");
  const input = document.querySelector("input");
  const messages = document.querySelector("#messages");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userCommand = input.value.trim();
    if (!userCommand) return;

    const messageElem = document.createElement("div");
    messageElem.textContent = `🧠 You: ${userCommand}`;
    messages.appendChild(messageElem);

    const responseElem = document.createElement("div");
    responseElem.textContent = "🤖 Mags is thinking...";
    messages.appendChild(responseElem);

    try {
      const res = await fetch("/app/api/run-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: userCommand }),
      });

      const data = await res.json();
      responseElem.textContent = `✨ Mags: ${data.result || "Done!"}`;
    } catch (error) {
      responseElem.textContent = `❌ Error: ${error.message}`;
    }

    input.value = "";
  });
});
document.addEventListener("DOMContentLoaded", () => {
  // find your form so we can place the button right after it
  const form = document.querySelector("form");

  // create the button
  const liveBtn = document.createElement("button");
  liveBtn.id = "startLive";
  liveBtn.type = "button"; // so it doesn't submit the form
  liveBtn.textContent = "Start live session";

  // insert it right after the form
  if (form && form.parentNode) {
    form.parentNode.insertBefore(liveBtn, form.nextSibling);
  } else {
    // fallback: put it at the end of the body
    document.body.appendChild(liveBtn);
  }

  // wire the click to start the Browserless session
  liveBtn.addEventListener("click", async () => {
    try {
      const r = await fetch("/api/rpa/start?ttl=45000");
      const data = await r.json();
      if (!data.ok) {
        alert(data.error || "Could not start session");
        return;
      }
      // open the live viewer in a new tab
      window.open(data.viewerUrl, "_blank");
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  });
});
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
