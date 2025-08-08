const log = (m) => {
  const el = document.getElementById('log');
  el.textContent = (el.textContent ? el.textContent + '\n' : '') + m;
};

document.getElementById('btn-health').onclick = async () => {
  log('Calling /api/rpa/health …');
  const r = await fetch('/api/rpa/health');
  const j = await r.json();
  log(JSON.stringify(j, null, 2));
};

document.getElementById('btn-start').onclick = async () => {
  log('Calling /api/rpa/start?ttl=45000 …');
  const r = await fetch('/api/rpa/start?ttl=45000');
  const j = await r.json();
  log(JSON.stringify(j, null, 2));
};

document.getElementById('btn-viewer').onclick = () => {
  log('Opening /api/rpa/viewer?redirect=1 …');
  window.open('/api/rpa/viewer?redirect=1', '_blank');
};

document.getElementById('btn-blank').onclick = () => {
  // just open the viewer (may look dark/blank at first)
  window.open('/api/rpa/viewer?redirect=1', '_blank');
};

document.getElementById('btn-open').onclick = async () => {
  let u = document.getElementById('url').value.trim();
  if (!u) u = 'https://dashboard.stripe.com/login';
  log('Starting session + preloading: ' + u);
  const r = await fetch('/api/rpa/start?ttl=45000&url=' + encodeURIComponent(u));
  const j = await r.json();
  if (!j.ok) {
    log('ERROR: ' + (j.error || 'Could not start session'));
    alert(j.error || 'Could not start session');
    return;
  }
  window.open(j.viewerUrl, '_blank');
  log('Opened viewer.');
};
