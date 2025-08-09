async function main() {
  const status = document.getElementById('status');
  const params = new URLSearchParams(window.location.search);
  let viewerUrl = params.get('viewerUrl');
  const url = params.get('url');

  if (!viewerUrl) {
    status.textContent = 'Starting session…';
    const qs = new URLSearchParams({ ttl: '45000' });
    if (url) qs.set('url', url);
    const r = await fetch('/api/rpa/start?' + qs.toString());
    const j = await r.json().catch(() => ({}));
    if (!j.ok) {
      status.textContent = 'Error starting session';
      return;
    }
    viewerUrl = j.viewerUrl;
  }

  status.textContent = 'Connecting…';
  const frame = document.createElement('iframe');
  frame.src = viewerUrl;
  frame.style.width = '100%';
  frame.style.height = '90vh';
  document.body.appendChild(frame);

  setTimeout(() => {
    try {
      const doc = frame.contentDocument;
      if (!doc || doc.body.innerHTML.trim() === '') {
        status.innerHTML = `If blank, <a href="${viewerUrl}" target="_blank" rel="noopener">open viewer in new tab</a>.`;
      } else {
        status.textContent = '';
      }
    } catch (e) {
      status.innerHTML = `If blank, <a href="${viewerUrl}" target="_blank" rel="noopener">open viewer in new tab</a>.`;
    }
  }, 1000);
}

main();
