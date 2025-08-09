(function () {
  const $ = (s) => document.querySelector(s);
  $('#watchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = $('#url').value.trim();
    $('#out').textContent = 'Starting…';
    try {
      const r = await fetch('/api/rpa/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const json = await r.json().catch(() => ({}));
      $('#out').textContent = JSON.stringify(json, null, 2);
    } catch (err) {
      $('#out').textContent = JSON.stringify({ ok: false, error: String(err) }, null, 2);
    }
  });
})();
