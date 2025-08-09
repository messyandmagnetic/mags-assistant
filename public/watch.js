const $ = (id) => document.getElementById(id);

$("start").onclick = async () => {
  const url = $("url").value.trim();
  if (!url) {
    $("out").textContent = "missing URL";
    return;
  }
  $("out").textContent = "Starting…";
  try {
    const r = await fetch("/api/rpa/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });
    const data = await r.json();
    $("out").textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    $("out").textContent = JSON.stringify({ ok: false, error: err.message || String(err) }, null, 2);
  }
};
