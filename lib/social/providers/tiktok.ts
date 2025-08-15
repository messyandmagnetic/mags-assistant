import { loadAccounts, humanizeDelay } from '../tiktokScheduler.js';

export async function post({
  caption,
  mediaUrl,
  linkUrl,
  scheduleTime,
}: {
  caption?: string;
  mediaUrl?: string;
  linkUrl?: string;
  scheduleTime?: number;
}) {
  const accounts = await loadAccounts();
  for (const acct of accounts) {
    if (process.env.OFFLINE_MODE === 'true') {
      console.log(`[tiktok:${acct.username}] offline mode — skipping external calls`);
      continue;
    }
    if (scheduleTime) {
      console.log(`[tiktok:${acct.username}] schedule`, { caption, mediaUrl, scheduleTime });
    } else {
      await new Promise((r) => setTimeout(r, humanizeDelay()));
      console.log(`[tiktok:${acct.username}] post`, {
        caption,
        mediaUrl,
        linkUrl,
        session: acct.id,
      });
    }
  }
  return 'ok';
}
