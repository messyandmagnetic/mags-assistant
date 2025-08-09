(function () {
  const $ = (s) => document.querySelector(s);
  function toast(text) {
    let el = document.getElementById('toast');
    if (!el) {
      const style = document.createElement('style');
      style.textContent = `#toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 20px;border-radius:8px;opacity:0;transition:opacity .3s;}#toast.show{opacity:1;}`;
      document.head.appendChild(style);
      el = document.createElement('div');
      el.id = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3000);
  }

  const msg = $('#msg');
  $('#watchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = $('#url').value.trim();
    msg.textContent = 'Starting…';
    msg.style.color = '';
    try {
      const r = await fetch('/api/rpa/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (!r.ok) {
        throw new Error(`HTTP ${r.status}`);
      }
      const json = await r.json().catch(() => ({}));
      if (json.ok) {
        msg.textContent = 'Started';
        msg.style.color = 'green';
      } else {
        throw new Error(json.error || json.message || 'Error');
      }
    } catch (err) {
      msg.textContent = 'Error';
      msg.style.color = 'red';
      toast(String(err));
    }
  });
})();
