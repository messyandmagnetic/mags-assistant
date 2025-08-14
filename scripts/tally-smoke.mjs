import { readFileSync } from 'node:fs';

const SECRET = process.env.TALLY_WEBHOOK_SECRET || '';
const GAS = process.env.GAS_READ_URL || '';

async function run() {
  const cfg = JSON.parse(readFileSync('public/mags-config.json', 'utf8'));
  const worker = cfg?.cloudflare?.worker_url || process.env.WORKER_URL || '';
  const forms = cfg?.intake?.tally?.forms || [];
  if (!worker || !GAS) {
    console.error('missing worker or GAS_READ_URL');
    return;
  }
  for (const f of forms) {
    const submission_id = `smoke-${f.form_id}-${Date.now()}`;
    const payload = { form_id: f.form_id, submission_id, email: 'test@example.com' };
    const headers = { 'content-type': 'application/json' };
    if (SECRET) headers['tally-webhook-secret'] = SECRET;
    await fetch(`${worker}/tally/webhook`, { method: 'POST', headers, body: JSON.stringify(payload) }).catch(() => {});
    await new Promise(r => setTimeout(r, 1000));
    const url = `${GAS}?sheetId=${encodeURIComponent(f.sheet_id)}&tab=${encodeURIComponent(f.tab)}&limit=5`;
    const rows = await fetch(url).then(r => r.json()).catch(() => []);
    const arr = Array.isArray(rows) ? rows : rows.rows || [];
    const found = arr.some(r => r.submission_id === submission_id);
    console.log(f.form_id, found ? 'ok' : 'missing');
  }
}

run();

