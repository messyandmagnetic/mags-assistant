import { readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync('public/mags-config.json', 'utf8'));
const forms = cfg?.intake?.tally?.forms || [];
const worker = cfg?.cloudflare?.worker_url || '';
const gas = process.env.GAS_INTAKE_URL || '';

if (!worker) console.warn('missing worker_url in config');
if (!gas) console.warn('missing GAS_INTAKE_URL');

for (const f of forms) {
  const payload = {
    form_id: f.form_id,
    submission_id: 'test-' + f.form_id,
    email: 'test@example.com'
  };
  const url = worker ? `${worker}/tally/webhook` : '/tally/webhook';
  const cmd = `curl -X POST ${url} -H 'content-type: application/json' -d '${JSON.stringify(payload)}'`;
  console.log(cmd);
}
