(() => {
  const preset = document.querySelector('#presetUrl');
  const urlInput = document.querySelector('#url');
  const startBtn = document.querySelector('#start');
  const runBothBtn = document.querySelector('#runBoth');
  const out = document.querySelector('#out');

  function show(data) {
    out.textContent += JSON.stringify(data, null, 2) + '\n';
  }

  function showErr(err) {
    out.textContent += 'Error: ' + (err && err.message ? err.message : err) + '\n';
  }

  preset?.addEventListener('change', () => {
    urlInput.value = preset.value;
  });

  startBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    out.textContent = '';
    const url = document.querySelector('#url').value.trim();
    fetch('/api/rpa/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    })
      .then((r) => r.json())
      .then(show)
      .catch(showErr);
  });

  runBothBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    out.textContent = '';
    const vals = Array.from(preset.options).map((o) => o.value);
    for (const val of vals) {
      try {
        const r = await fetch('/api/rpa/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: val })
        });
        const j = await r.json();
        show(j);
      } catch (err) {
        showErr(err);
      }
    }
  });
})();
