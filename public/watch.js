(function () {
  const $ = (s) => document.querySelector(s);
  const msg = $('#msg');
  $('#watchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = $('#url').value.trim();
    msg.textContent = 'Starting…';
    msg.style.color = '';
    try {
      const r = await fetch('/api/rpa?action=start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const json = await r.json().catch(() => ({}));
      if (r.ok && json.ok) {
        msg.textContent = 'Started';
        msg.style.color = 'green';
      } else {
        msg.textContent = json.error || json.message || 'Error';
        msg.style.color = 'red';
      }
    } catch (err) {
      msg.textContent = String(err);
      msg.style.color = 'red';
    }
  });
})();
