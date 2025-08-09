(() => {
  const startBtn = document.getElementById('start');
  const urlInput = document.getElementById('url');
  const status = document.getElementById('status');
  const log = (m) => { if (status) status.textContent = m; };

  startBtn?.addEventListener('click', async () => {
    const url = urlInput?.value || '';
    log('Starting cloud browser…');
    try {
      const res = await fetch('/api/rpa/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        log('Error: ' + (json.error || res.statusText));
        return;
      }
      const dest = json.viewerUrl || json.viewerUrlAlt || json.url;
      if (dest) {
        const link = document.createElement('a');
        link.href = dest;
        link.textContent = 'Open viewer';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        status.innerHTML = '';
        status.append('Started. ', link);
      } else {
        log('Started.');
      }
    } catch (e) {
      log('Error: ' + e.message);
    }
  });
})();
