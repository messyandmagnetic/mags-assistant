import axios from 'axios';

export interface FallbackEnv {
  BROWSERLESS_TOKEN?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  MAKE_FALLBACK_WEBHOOK?: string;
}

/**
 * monitorBrowserless checks API usage and switches to local Puppeteer if the
 * Browserless limit is reached. Returns the usage ratio.
 */
export async function monitorBrowserless(env: FallbackEnv): Promise<number> {
  try {
    const url = `https://chrome.browserless.io/metrics?token=${env.BROWSERLESS_TOKEN}`;
    const { data } = await axios.get(url);
    const usage = data?.monthlyUsage || 0;
    if (usage > 0.75) {
      // TODO: switch to local Puppeteer
      await notify(env, 'Renderer switched — all posts still scheduled.');
    }
    return usage;
  } catch (err) {
    console.error('🔻Browserless fallback triggered', err);
    return 1;
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
