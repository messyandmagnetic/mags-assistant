import os from 'os';
import { MaggieTikTokAutomation, runMaggieTikTokLoop, retryPostQueue, TikTokAutomationEnv } from './maggie-tiktok';
import { sendTelegram } from './maggie-utils';
import { getEnv } from '../env.local';

export async function deployTikTokBot() {
  const env: TikTokAutomationEnv = {
    TELEGRAM_BOT_TOKEN: await getEnv('TELEGRAM_BOT_TOKEN'),
    TELEGRAM_CHAT_ID: await getEnv('TELEGRAM_CHAT_ID'),
    SHEET_ID: await getEnv('SHEET_ID'),
    DRIVE_FOLDER_ID: await getEnv('DRIVE_FOLDER_ID'),
    DRIVE_FINAL_FOLDER_ID: await getEnv('DRIVE_FINAL_FOLDER_ID'),
    BROWSERLESS_URL: await getEnv('BROWSERLESS_URL'),
    MAKE_FALLBACK_WEBHOOK: await getEnv('MAKE_FALLBACK_WEBHOOK'),
  };
  const maggie = new MaggieTikTokAutomation(env);
  await maggie.watchFolder();
  await maggie.detectAndRecoverFlops();
  await maggie.scheduleTikToks();
  await sendTelegram(env, '🚀 TikTok bot deployed');
}

export async function healMaggie() {
  const env: TikTokAutomationEnv = {
    TELEGRAM_BOT_TOKEN: await getEnv('TELEGRAM_BOT_TOKEN'),
    TELEGRAM_CHAT_ID: await getEnv('TELEGRAM_CHAT_ID'),
  };
  await sendTelegram(env, '🧘 Maggie is on retreat');
  const check = async () => {
    const load = os.loadavg()[0];
    if (load < 0.75) {
      await sendTelegram(env, '🔄 Maggie returning from retreat');
      await retryPostQueue();
    } else {
      setTimeout(check, 5 * 60 * 1000);
    }
  };
  check();
}

export async function notifyViaTelegram(text: string) {
  const env = {
    TELEGRAM_BOT_TOKEN: await getEnv('TELEGRAM_BOT_TOKEN'),
    TELEGRAM_CHAT_ID: await getEnv('TELEGRAM_CHAT_ID'),
  };
  await sendTelegram(env, text);
}
