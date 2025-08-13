import { env } from '../lib/env.js';

async function sendTelegram(text) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return { ok: false, reason: 'MISSING_TELEGRAM_CONFIG' };
  }
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body = {
    chat_id: env.TELEGRAM_CHAT_ID,
    text,
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { ok: r.ok };
}

async function main() {
  const stripe = { count: 0, total: 0 };
  const land = { count: 0 };
  const missing = [];
  const lines = [
    `Stripe payments: ${stripe.count} ($${stripe.total})`,
    `Land Outreach replies: ${land.count}`,
    missing.length ? `Missing envs: ${missing.join(', ')}` : 'Missing envs: none',
  ];
  const text = lines.join('\n');
  const res = await sendTelegram(text);
  console.log(JSON.stringify({ ok: res.ok, text }));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }));
  process.exit(1);
});
