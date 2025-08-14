import fs from 'fs/promises';
import { getSecret, guard } from '../utils/safe-env';

(async () => {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: status-to-telegram <status.json>');
    process.exit(1);
  }

  const token = getSecret('TELEGRAM_BOT_TOKEN');
  const chat = getSecret('TELEGRAM_CHAT_ID');

  if (!token.present || !chat.present) {
    console.log('telegram: skipped');
    return;
  }

  const data = JSON.parse(await fs.readFile(file, 'utf8'));
  const summary = data.checks.map((c: any) => `- ${c.name}: ${c.status}`).join('\n');
  const text = `*Mags status*\n${summary}`;

  const res = await guard('telegram', async () => {
    const resp = await fetch(`https://api.telegram.org/bot${token.value}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat.value, text, parse_mode: 'Markdown' }),
    });
    if (!resp.ok) throw new Error(`status ${resp.status}`);
    return await resp.json();
  });

  if (res.ok) {
    console.log('telegram: sent');
  } else {
    console.log('telegram: error', res.error);
  }
})();
