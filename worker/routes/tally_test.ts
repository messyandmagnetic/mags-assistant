import { CANONICAL_COLUMNS, normalizeSubmission } from '../lib/schema';
import { ensureHeaders, upsertRow, Env as SheetsEnv } from '../lib/sheets';
import { SHEET_ID_QUIZ } from '../lib/config';

export interface Env extends SheetsEnv {}

export async function handleTallyTest(_req: Request, env: Env): Promise<Response> {
  const row = normalizeSubmission({
    submission_id: `test-${Date.now()}`,
    submitted_at: new Date().toISOString(),
    source: 'maggie',
    email: 'test@example.com',
    full_name: 'Test User',
    handle: '@test',
    test: 'true',
  });
  row.processed_at = new Date().toISOString();
  await ensureHeaders(env, SHEET_ID_QUIZ, 'Submissions_Clean', CANONICAL_COLUMNS);
  await upsertRow(env, SHEET_ID_QUIZ, 'Submissions_Clean', row, CANONICAL_COLUMNS);
  return new Response(JSON.stringify({ ok: true, id: row.submission_id }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
