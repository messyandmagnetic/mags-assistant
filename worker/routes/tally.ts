export interface Env {
  TALLY_WEBHOOK_SECRET?: string;
  GAS_INTAKE_URL?: string;
}

function hex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sign(body: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return hex(digest);
}

async function verifySignature(body: string, secret: string, signature: string) {
  const digest = await sign(body, secret);
  return digest === signature;
}

export async function handleTallyWebhook(req: Request, env: Env): Promise<Response> {
  const body = await req.text();
  const secret = env.TALLY_WEBHOOK_SECRET;
  if (secret) {
    const ok = await verifySignature(body, secret, req.headers.get('x-tally-signature') || '');
    if (!ok) return new Response('invalid signature', { status: 401 });
  }
  if (env.GAS_INTAKE_URL) {
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => (headers[k] = v));
    if (secret) headers['x-tally-signature'] = await sign(body, secret);
    const res = await postWithRetry(env.GAS_INTAKE_URL, { method: 'POST', body, headers });
    if (!res.ok) return new Response('upstream_error', { status: res.status });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
}

async function postWithRetry(url: string, init: RequestInit, tries = 3) {
  let attempt = 0;
  while (attempt < tries) {
    const res = await fetch(url, init);
    if (res.status < 500) return res;
    await new Promise((r) => setTimeout(r, 2 ** attempt * 200));
    attempt++;
  }
  return fetch(url, init);
}

export async function handleBackfill(req: Request, env: Env): Promise<Response> {
  if (!env.GAS_INTAKE_URL) return new Response('missing GAS_INTAKE_URL', { status: 500 });
  const url = new URL(req.url);
  const formId = url.searchParams.get('form_id') || '';
  const apiKey = req.headers.get('x-tally-key') || '';
  const target = `${env.GAS_INTAKE_URL}?action=backfill&form_id=${formId}`;
  const headers: Record<string, string> = {};
  if (apiKey) headers['x-tally-key'] = apiKey;
  const res = await fetch(target, { method: 'POST', headers });
  const text = await res.text();
  return new Response(text, { status: res.status, headers: { 'content-type': 'application/json' } });
}
