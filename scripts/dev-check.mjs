const WORKER = process.env.WORKER_URL || 'https://tight-snow-2840.messyandmagnetic.workers.dev';
const VERCEL = process.env.VERCEL_URL || 'https://mags-assistant.vercel.app';
const FETCH_PASS = process.env.FETCH_PASS;

async function test(name, url, opts = {}) {
  try {
    const res = await fetch(url, opts);
    console.log(`${res.ok ? 'PASS' : 'FAIL'} ${name} ${res.status}`);
  } catch (e) {
    console.log(`FAIL ${name} ${e.message}`);
  }
}

await test('Vercel /api/health', `${VERCEL}/api/health`);
await test('Vercel /api/stripe', `${VERCEL}/api/stripe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
await test('Worker /health', `${WORKER}/health`);
await test('Worker /agent/sync/stripe-to-notion', `${WORKER}/agent/sync/stripe-to-notion`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(FETCH_PASS ? { 'X-Fetch-Pass': FETCH_PASS } : {}) }, body: '{}' });
await test('Worker /agent/audit/prices', `${WORKER}/agent/audit/prices`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(FETCH_PASS ? { 'X-Fetch-Pass': FETCH_PASS } : {}) }, body: '{}' });
