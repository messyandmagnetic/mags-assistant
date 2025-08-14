export interface Env {
  TALLY_WEBHOOK_SECRET?: string;
  GAS_INTAKE_URL?: string;
}

function hex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifySignature(body: string, secret: string, signature: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return hex(digest) === signature;
}

export async function handleTallyWebhook(req: Request, env: Env): Promise<Response> {
  const body = await req.text();
  if (!env.TALLY_WEBHOOK_SECRET)
    return new Response('missing webhook secret', { status: 500 });
  const ok = await verifySignature(
    body,
    env.TALLY_WEBHOOK_SECRET,
    req.headers.get('tally-signature') || ''
  );
  if (!ok) return new Response('invalid signature', { status: 401 });
  if (env.GAS_INTAKE_URL) {
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => (headers[k] = v));
    await fetch(env.GAS_INTAKE_URL, { method: 'POST', body, headers });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
