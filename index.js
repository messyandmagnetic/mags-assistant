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
