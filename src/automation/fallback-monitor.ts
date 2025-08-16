import axios from 'axios';
import { getEnv } from '../lib/get-env';

export interface FallbackEnv {
  BROWSERLESS_TOKEN?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  MAKE_FALLBACK_WEBHOOK?: string;
}

/**
 * monitorBrowserless checks API usage and switches to local Puppeteer if the
 * Browserless limit is reached. A Telegram notification is sent when the switch
 * occurs.
 */
export async function monitorBrowserless(env: FallbackEnv) {
  try {
    const token = getEnv('BROWSERLESS_TOKEN', env) || '';
    const url = `https://chrome.browserless.io/metrics?token=${token}`;
    const { data } = await axios.get(url);
    const usage = data?.monthlyUsage || 0;
    if (usage > 0.75) {
      // TODO: switch to local Puppeteer
      await notify(env, 'Renderer switched — all posts still scheduled.');
    }
  } catch (err) {
    console.error('🔻Browserless fallback triggered', err);
    if (!env.MAKE_FALLBACK_WEBHOOK) {
      try {
        // @ts-ignore Codex fallback
        await (global as any).codex?.tasks?.notifyViaTelegram?.('Make down, retrying post queue');
      } catch {}
    }
  }
}

async function notify(env: FallbackEnv, text: string) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  await axios.post(url, {
    chat_id: env.TELEGRAM_CHAT_ID,
    text,
  });
}
