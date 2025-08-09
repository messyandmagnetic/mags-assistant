const $ = (id)=>document.getElementById(id);
$("go").onclick = async () => {
  const url = $("url").value.trim();
  $("out").textContent = "Starting…";
  try {
    const r = await fetch("/api/rpa/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });
    const data = await r.json().catch(()=>({error:"Invalid JSON"}));
    $("out").textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    $("out").textContent = JSON.stringify({ ok:false, error: String(e) }, null, 2);
  }
};
