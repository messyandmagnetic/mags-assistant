import { readFileSync } from 'node:fs';

const API = process.env.TALLY_API_KEY;

async function run() {
  if (!API) {
    console.error('missing TALLY_API_KEY');
    return;
  }
  const cfg = JSON.parse(readFileSync('public/mags-config.json', 'utf8'));
  const worker = cfg?.cloudflare?.worker_url || process.env.WORKER_URL || '';
  if (!worker) {
    console.error('missing worker url');
    return;
  }
  const dest = `${worker}/tally/webhook`;
  const forms = cfg?.intake?.tally?.forms || [];
  for (const f of forms) {
    const base = `https://api.tally.so/v1/forms/${f.form_id}`;
    const headers = { 'content-type': 'application/json', Authorization: `Bearer ${API}` };
    const hooks = await fetch(`${base}/webhooks`, { headers }).then(r => r.json()).then(r => r.data || r).catch(() => []);
    for (const h of hooks) {
      if (h.destination !== dest || hooks.filter(x => x.destination === dest).length > 1) {
        await fetch(`${base}/webhooks/${h.id}`, { method: 'DELETE', headers }).catch(() => {});
      }
    }
    const remaining = await fetch(`${base}/webhooks`, { headers })
      .then(r => r.json())
      .then(r => r.data || r)
      .catch(() => []);
    let hook = remaining.find(h => h.destination === dest);
    if (!hook) {
      hook = await fetch(`${base}/webhooks`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ destination: dest, enabled: true })
      }).then(r => r.json()).catch(() => ({}));
    }
    console.log('webhook', f.form_id, hook.id || hook.data?.id || 'created');
    const integrations = await fetch(`${base}/integrations`, { headers })
      .then(r => r.json())
      .then(r => r.data || [])
      .catch(() => []);
    for (const integ of integrations) {
      await fetch(`${base}/integrations/${integ.id}`, { method: 'DELETE', headers }).catch(() => {});
    }
  }
}

run();

