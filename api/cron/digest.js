import { env } from '../../lib/env.js';

function ok(res, data={}){ res.status(200).json({ ok: true, ...data }); }
function bad(res, reason){ res.status(401).json({ ok: false, reason }); }

export default async function(req, res) {
  const url = new URL(req.url, 'http://x');
  const secret = url.searchParams.get('secret');
  if (secret !== env.CRON_SECRET) return bad(res, 'unauthorized');
  const test = url.searchParams.get('test') === 'true';
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    try {
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: `digest${test ? ' test' : ''}` }),
      });
    } catch {}
  }
  ok(res);
}
