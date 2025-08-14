import cfg from '../../public/mags-config.json';

export interface Env {
  TALLY_WEBHOOK_SECRET?: string;
  GAS_INTAKE_URL?: string;
  WORKER_KEY?: string;
  NOTION_TOKEN?: string;
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

const recent = new Map<string, number>();
function seen(id: string, ttlMs = 5 * 60 * 1000) {
  const now = Date.now();
  const last = recent.get(id);
  if (last && now - last < ttlMs) return true;
  recent.set(id, now);
  return false;
}

async function log(entry: unknown, env: Env) {
  const base = cfg.worker?.base || '';
  if (!base) {
    console.log('log', entry);
    return;
  }
  try {
    await fetch(base.replace(/\/$/, '') + '/logs', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-worker-key': env.WORKER_KEY || '',
      },
      body: JSON.stringify(entry),
    });
  } catch (err) {
    console.log('log_error', err);
  }
}

async function writeNotion(env: Env, body: string, formId: string, submissionId: string) {
  const inbox = cfg?.brain?.inbox?.notion_page_or_db_id || '';
  if (!inbox || !env.NOTION_TOKEN) return { skipped: true };
  const headers = {
    'content-type': 'application/json',
    Authorization: `Bearer ${env.NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
  };
  const parentKey = inbox.length === 32 ? 'database_id' : 'page_id';
  const payload = {
    parent: { [parentKey]: inbox },
    properties: {
      title: { title: [{ text: { content: submissionId || 'tally-submission' } }] },
    },
    children: [
      {
        object: 'block',
        type: 'code',
        code: {
          language: 'json',
          rich_text: [{ type: 'text', text: { content: body } }],
        },
      },
    ],
  };
  try {
    const r = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return { ok: r.ok, status: r.status };
  } catch (err) {
    return { ok: false, error: 'notion_error' };
  }
}

export async function handleTallyIntake(req: Request, env: Env): Promise<Response> {
  if (env.WORKER_KEY) {
    const key = req.headers.get('x-worker-key') || '';
    if (key !== env.WORKER_KEY) return new Response('unauthorized', { status: 401 });
  }
  const body = await req.text();
  const secret = env.TALLY_WEBHOOK_SECRET;
  if (secret) {
    const ok = await verifySignature(body, secret, req.headers.get('x-tally-signature') || '');
    if (!ok) return new Response('invalid signature', { status: 401 });
  }
  let data: any = {};
  try {
    data = JSON.parse(body);
  } catch (err) {
    return new Response('invalid_json', { status: 400 });
  }
  const formId = data?.form_id;
  const allowed = ['3qlZQ9', 'nGPKDo'];
  if (!formId || !allowed.includes(formId)) {
    return new Response('invalid_form_id', { status: 400 });
  }
  const submissionId = data?.submission_id || '';
  if (submissionId && seen(submissionId)) {
    return new Response(JSON.stringify({ ok: true, duplicate: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    if (k === 'content-type' || k.startsWith('tally') || k.startsWith('x-tally')) {
      headers[k] = v;
    }
  });
  if (secret) headers['x-tally-signature'] = await sign(body, secret);
  let gas = { skipped: true } as any;
  if (env.GAS_INTAKE_URL) {
    const res = await postWithRetry(env.GAS_INTAKE_URL, { method: 'POST', body, headers });
    gas = { ok: res.ok, status: res.status };
  }
  const notion = await writeNotion(env, body, formId, submissionId);
  await log({ form_id: formId, submission_id: submissionId, gas, notion }, env);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
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
