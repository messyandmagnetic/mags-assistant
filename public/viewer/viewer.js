(function(){
  const form = document.getElementById('viewerForm');
  const urlInput = document.getElementById('url');
  const result = document.getElementById('result');
  const hint = document.getElementById('hint');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = urlInput.value.trim();
    hint.textContent = '';
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:') {
        hint.textContent = 'URL must start with https://';
        return;
      }
    } catch {
      hint.textContent = 'Please enter a valid https URL';
      return;
    }
    result.textContent = 'Starting…';
    try {
      const r = await fetch('/api/rpa/start', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ url })
      });
      const json = await r.json().catch(()=>({}));
      result.textContent = JSON.stringify(json, null, 2);
    } catch (err) {
      result.textContent = JSON.stringify({ ok:false, message:String(err) }, null, 2);
    }
  });
})();
