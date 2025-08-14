import { CANONICAL_COLUMNS, normalizeSubmission } from '../lib/schema';
import { ensureHeaders, upsertRow, Env as SheetsEnv } from '../lib/sheets';
import {
  SHEET_ID_QUIZ,
  SHEET_ID_FEEDBACK,
  TALLY_FORM_ID_QUIZ,
  TALLY_FORM_ID_FEEDBACK,
} from '../lib/config';

export interface Env extends SheetsEnv {
  TALLY_WEBHOOK_SECRET?: string;
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

function extractSubmission(payload: any) {
  const base: Record<string, any> = {};
  const data = payload?.data || payload;
  base.submission_id = data.id || payload.responseId || '';
  base.submitted_at = data.createdAt || payload.created_at || new Date().toISOString();
  const answers: Record<string, any> = {};
  const fields = data?.data || data?.fields || [];
  if (Array.isArray(fields)) {
    for (const f of fields) {
      const label = f.label || f.title || f.key;
      const value = f.value || f.answer || '';
      answers[label] = typeof value === 'string' ? value : JSON.stringify(value);
    }
  } else if (fields && typeof fields === 'object') {
    Object.assign(answers, fields);
  }
  Object.assign(base, answers);
  return normalizeSubmission(base);
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
  const payload = JSON.parse(body);
  const submission = extractSubmission(payload);
  submission.source = 'maggie';
  submission.processed_at = new Date().toISOString();
  const formId = payload?.data?.formId || payload.formId;
  const sheetId = formId === TALLY_FORM_ID_FEEDBACK ? SHEET_ID_FEEDBACK : SHEET_ID_QUIZ;
  await ensureHeaders(env, sheetId, 'Submissions_Clean', CANONICAL_COLUMNS);
  await upsertRow(env, sheetId, 'Submissions_Clean', submission, CANONICAL_COLUMNS);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
