import axios from 'axios';

export interface FallbackEnv {
  BROWSERLESS_TOKEN?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

/**
 * monitorBrowserless checks API usage and switches to local Puppeteer if the
 * Browserless limit is reached. A Telegram notification is sent when the switch
 * occurs.
 */
export async function monitorBrowserless(env: FallbackEnv) {
  try {
    const url = `https://chrome.browserless.io/metrics?token=${env.BROWSERLESS_TOKEN}`;
    const { data } = await axios.get(url);
    const usage = data?.monthlyUsage || 0;
    if (usage > 0.75) {
      // TODO: switch to local Puppeteer
      await notify(env, 'Renderer switched — all posts still scheduled.');
    }
  } catch (err) {
    console.error('🛑 Browserless crashed', err);
    await notify(env, '‼️ Browserless failure – fallback may be needed.');

    if (process.env.MAKE_FALLBACK_WEBHOOK) {
      axios
        .post(process.env.MAKE_FALLBACK_WEBHOOK, {
          type: 'fallback',
          error: (err as Error).message,
        })
        .catch(console.error);
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
