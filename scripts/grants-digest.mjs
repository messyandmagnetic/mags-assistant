import fs from 'node:fs/promises';

const readJson = async (p, def) => {
  try {
    return JSON.parse(await fs.readFile(p, 'utf8'));
  } catch {
    return def;
  }
};

const inbox = await readJson('public/.inbox-land.json', []);
const donationLinks = await readJson('public/.donation-links.json', []);
const tallySync = await readJson('public/.tally-sync.json', []);
const schedulePack = await readJson('public/schedule-pack.json', { queue: [] });

const grantsCount = Array.isArray(inbox) ? inbox.length : 0;
const replyCount = Array.isArray(tallySync) ? tallySync.length : 0;
const videoCount = Array.isArray(schedulePack.queue) ? schedulePack.queue.length : 0;

const digest = {
  generated_at: new Date().toISOString(),
  counts: { grants: grantsCount, replies: replyCount, videos: videoCount },
  grants: inbox
};

await fs.writeFile('public/.grants-digest.json', JSON.stringify(digest, null, 2));

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (token && chatId) {
  const text = `\uD83E\uDDE0 Digest Ready: ${grantsCount} new grants, ${replyCount} replies, ${videoCount} queued videos`;
  const buttons = {
    inline_keyboard: [
      [{ text: '\uD83D\uDD01 Reply', callback_data: 'reply' }],
      [{ text: '\uD83D\uDECF\uFE0F Snooze', callback_data: 'snooze' }],
      [{ text: '\u2705 Archive', callback_data: 'archive' }]
    ]
  };
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, reply_markup: buttons })
    });
    console.log('Digest sent to Telegram');
  } catch (err) {
    console.error('Failed to send Telegram message', err);
  }
} else {
  console.log('Missing Telegram credentials, skipping send.');
}
