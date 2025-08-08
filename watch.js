const statusEl = document.getElementById('status');

async function init() {
  const params = new URLSearchParams(window.location.search);
  const viewerUrl = params.get('viewerUrl');
  const url = params.get('url');
  const ttl = params.get('ttl');

  if (viewerUrl) {
    window.location.href = viewerUrl;
    return;
  }

  if (!url) {
    statusEl.textContent = 'Missing url or viewerUrl parameter';
    return;
  }

  try {
    let q = `/api/rpa/start-view?url=${encodeURIComponent(url)}`;
    if (ttl) q += `&ttl=${encodeURIComponent(ttl)}`;
    const r = await fetch(q);
    const data = await r.json();
    if (!data.ok) {
      statusEl.textContent = data.error || 'Failed to start session';
      return;
    }
    window.location.href = data.viewerUrl;
  } catch (e) {
    statusEl.textContent = e.message;
  }
}

init();
