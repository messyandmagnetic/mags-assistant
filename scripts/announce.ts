const summary = process.argv.slice(2).join(' ') || 'Ops task completed.';

async function sendEmail(summary: string) {
  const { RESEND_API_KEY, NOTIFY_EMAIL } = process.env as Record<string, string>;
  if (!RESEND_API_KEY || !NOTIFY_EMAIL) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Mags Ops <onboarding@resend.dev>',
      to: NOTIFY_EMAIL,
      subject: 'Mags Ops Fallback',
      text: summary,
    }),
  });
  console.log('Sent email to', NOTIFY_EMAIL);
}

async function sendTelegram(summary: string) {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env as Record<string, string>;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: summary }),
  });
  console.log('Sent Telegram message');
}

async function main() {
  await Promise.all([sendEmail(summary), sendTelegram(summary)]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
