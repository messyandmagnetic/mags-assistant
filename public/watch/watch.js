(async () => {
  const status = document.getElementById('status');
  const log = (m) => { if (status) status.textContent = m; };

  try {
    log('Starting cloud browser…');
    const urlToOpen = 'https://dashboard.stripe.com/login';
    const res = await fetch('/api/rpa/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlToOpen })
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      log('Error: ' + (json.error || res.statusText));
      return;
    }
    const dest = json.viewerUrl || json.viewerUrlAlt || json.url;
    if (dest) {
      log('Opening…');
      window.location.href = dest;
    } else {
      log('Error: missing url');
    }
  } catch (e) {
    log('Error: ' + e.message);
  }
})();
