const log = (m) => {
  const el = document.getElementById('log');
  el.innerHTML += (el.textContent.trim() ? '<br>' : '') + m;
};

async function stubbornOpen(viewerUrl, viewerUrlAlt) {
  let opened = viewerUrl ? window.open(viewerUrl, '_blank') : null;
  if (!opened && viewerUrlAlt) opened = window.open(viewerUrlAlt, '_blank');
  if (!opened && viewerUrl) { window.location.assign(viewerUrl); opened = true; }
  if (!opened && viewerUrlAlt) { window.location.assign(viewerUrlAlt); opened = true; }
  if (!opened) {
    const link = viewerUrlAlt || viewerUrl;
    log(`Popup blocked — <a href="${link}" target="_blank">click here</a> (or paste from clipboard).`);
    try { await navigator.clipboard.writeText(link); } catch {}
    alert('Popup blocked. I copied the viewer URL to your clipboard — paste it in a new tab immediately.');
  }
}

async function startSession(preloadUrl) {
  const ttl = 120000; // 2 minutes
  const q = preloadUrl ? `?ttl=${ttl}&url=${encodeURIComponent(preloadUrl)}` : `?ttl=${ttl}`;
  const r = await fetch('/api/rpa/start' + q);
  const j = await r.json();
  log('Start JSON → ' + JSON.stringify({ ok: j.ok, ttl: j.ttl }, null, 2));
  if (!j.ok) throw new Error(j.error || 'Failed to start session');
  await stubbornOpen(j.viewerUrl, j.viewerUrlAlt);
}

document.getElementById('btn-health').onclick = async () => {
  const r = await fetch('/api/rpa/health'); const j = await r.json();
  log('Health → ' + JSON.stringify(j));
};

document.getElementById('btn-start').onclick = async () => {
  try { await startSession(''); } catch (e) { alert(e.message); }
};

document.getElementById('btn-blank').onclick = async () => {
  try { await startSession(''); } catch (e) { alert(e.message); }
};

document.getElementById('btn-open').onclick = async () => {
  let u = document.getElementById('url').value.trim();
  if (!u) u = 'https://dashboard.stripe.com/login';
  try { await startSession(u); } catch (e) { alert(e.message); }
};
