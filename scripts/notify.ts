import process from 'node:process';

const token = process.env.TELEGRAM_BOT_TOKEN;
const chat = process.env.TELEGRAM_CHAT_ID;
const msg = process.argv.slice(2).join(' ');

if (!token || !chat || !msg) {
  console.error('missing telegram config or message');
  process.exit(0);
}

fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ chat_id: chat, text: msg })
})
  .then(res => {
    if (!res.ok) {
      return res.text().then(t => console.error('telegram request failed', t));
    }
  })
  .catch(err => console.error('telegram error', err));
