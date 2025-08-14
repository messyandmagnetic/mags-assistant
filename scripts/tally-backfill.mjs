import { readFileSync } from 'node:fs';

const API = process.env.TALLY_API_KEY;
const SECRET = process.env.TALLY_WEBHOOK_SECRET || '';

async function postToWorker(worker, payload) {
  const headers = { 'content-type': 'application/json' };
  if (SECRET) headers['tally-webhook-secret'] = SECRET;
  await fetch(`${worker}/tally/webhook`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  }).catch(() => {});
}

async function backfillForm(worker, formId) {
  if (!API) {
    console.error('missing TALLY_API_KEY');
    return;
  }
  let page = 1;
  const limit = 100;
  while (true) {
    const url = `https://api.tally.so/v1/forms/${formId}/responses?page=${page}&limit=${limit}`;
    const headers = { Authorization: `Bearer ${API}` };
    const res = await fetch(url, { headers }).then(r => r.json()).catch(() => ({}));
    const list = res.data || [];
    if (!list.length) break;
    for (const r of list) {
      await postToWorker(worker, r);
    }
    if (list.length < limit) break;
    page++;
  }
  console.log('backfill complete', formId);
}

async function run() {
  const cfg = JSON.parse(readFileSync('public/mags-config.json', 'utf8'));
  const worker = cfg?.cloudflare?.worker_url || process.env.WORKER_URL || '';
  if (!worker) {
    console.error('missing worker url');
    return;
  }
  const forms = cfg?.intake?.tally?.forms || [];
  for (const f of forms) {
    await backfillForm(worker, f.form_id);
  }
}

run();

