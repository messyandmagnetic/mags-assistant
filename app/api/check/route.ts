import { NextRequest } from 'next/server';
import { tgSend } from '../../../lib/telegram';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const results: Record<string, string> = {};
  let ok = true;

  const workerBase = process.env.GOOGLE_KEY_URL ? process.env.GOOGLE_KEY_URL.replace(/\/mags-key$/, '') : '';
  if (workerBase) {
    try {
      const r = await fetch(`${workerBase}/health`);
      results.worker = r.ok ? 'ok' : `status ${r.status}`;
      if (!r.ok) ok = false;
    } catch {
      results.worker = 'error';
      ok = false;
    }
  } else {
    results.worker = 'skipped';
  }

  try {
    const r = await fetch(`${req.nextUrl.origin}/api/ping`);
    const j = await r.json().catch(() => ({}));
    results.ping = j.ok ? 'ok' : 'fail';
    if (!j.ok) ok = false;
  } catch {
    results.ping = 'error';
    ok = false;
  }

  try {
    const r = await fetch(`${req.nextUrl.origin}/api/echo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    results.echo = r.ok ? 'ok' : `status ${r.status}`;
    if (!r.ok) ok = false;
  } catch {
    results.echo = 'error';
    ok = false;
  }

  const notify = req.nextUrl.searchParams.get('notify') === '1';
  const detail = JSON.stringify(results);
  if (!ok) {
    await tgSend(`❌ Check failed: ${detail}`);
  } else if (notify) {
    await tgSend('✅ Check ok');
  }

  return Response.json({ ok, ...results });
}
