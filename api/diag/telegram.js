import { env } from '../../lib/env.js';

export default async function(req, res) {
  const next_steps = [];
  if (!env.TELEGRAM_BOT_TOKEN) {
    next_steps.push('Set TELEGRAM_BOT_TOKEN');
    return res.json({ ok: false, reason: 'missing TELEGRAM_BOT_TOKEN', next_steps });
  }
  const url = new URL(req.url, 'http://x');
  const send = url.searchParams.get('send') === 'true';
  if (send) {
    if (!env.TELEGRAM_CHAT_ID) {
      next_steps.push('Set TELEGRAM_CHAT_ID');
      return res.json({ ok: false, reason: 'missing TELEGRAM_CHAT_ID', next_steps });
    }
    try {
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: 'diag ping' }),
      });
    } catch (e) {
      return res.json({ ok: false, reason: e.message, next_steps });
    }
  }
  res.json({ ok: true, sent: send });
}
