(async () => {
  const status = document.getElementById('status');
  const log = (m) => { if (status) status.textContent = m; };

  try {
    log('Starting cloud browser…');
    const urlToOpen = 'https://dashboard.stripe.com/login';
    const res = await fetch('/api/rpa/start?ttl=45000&url=' + encodeURIComponent(urlToOpen));
    const json = await res.json();
    if (!res.ok || !json.ok) {
      log('Error: ' + (json.error || res.statusText));
      return;
    }
    log('Opening live viewer…');
    window.location.href = json.viewerUrl || json.viewerUrlAlt;
  } catch (e) {
    log('Error: ' + e.message);
  }
})();
