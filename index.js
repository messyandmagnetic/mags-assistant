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
    responseElem.textContent = "💬 Mags is thinking...";
    messages.appendChild(responseElem);

    try {
      const res = await fetch("/api/run-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: userCommand }),
      });

      const data = await res.json();
      responseElem.textContent = `✨ Mags: ${data.message || "Done!"}`;
    } catch (error) {
      responseElem.textContent = `❌ Error: ${error.message}`;
    }

    input.value = "";
  });
});
