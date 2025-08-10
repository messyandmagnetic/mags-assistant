async function run() {
  const cmd = document.getElementById('cmd').value;
  const args = document.getElementById('args').value;
  const res = await fetch('/api/commands/run', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ command: cmd, args }),
  });
  const data = await res.json();
  document.getElementById('result').textContent = JSON.stringify(data, null, 2);
}

document.getElementById('run').addEventListener('click', run);
