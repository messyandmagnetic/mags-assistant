import {
  fetchRawFiles,
  renameFiles,
  extractEmotionKeywords,
  appendRow,
  fetchRows,
  colorCodeRow,
  renderVideo,
  uploadToTikTok,
  sendTelegram,
  findFlops,
  fetchTrending,
  cleanup,
} from './maggie-utils';

import {
  startRawWatcher,
  WatcherEnv,
  schedulePosts,
  SchedulerEnv,
  startFlopCron,
  FlopEnv,
  monitorBrowserless,
  FallbackEnv,
} from './maggie-tasks';

export interface TikTokAutomationEnv {
  DRIVE_FOLDER_ID?: string; // Raw video drop
  DRIVE_FINAL_FOLDER_ID?: string; // Edited outputs
  SHEET_ID?: string; // Tracker sheet
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  BROWSERLESS_URL?: string;
}

// Apply triggers
startRawWatcher();
schedulePosts();
startFlopCron();
monitorBrowserless();

// Inject runtime env vars (for safety)
process.env.TELEGRAM_BOT_TOKEN = '8482437764:AAFsXsSWA4NE3ZP1YEYpoJ_K0iNKPm07PdU';
process.env.TELEGRAM_CHAT_ID = '8440497509';
process.env.DRIVE_FOLDER_ID = '1m-OjLhXttfS655ldGJxr9xFOqsWY25sD';
process.env.DRIVE_FINAL_FOLDER_ID = 'FINAL_FOLDER_ID_HERE'; // Replace if needed
process.env.SHEET_ID = '1nP7As9RBiHNwWdADt60W_cx0bj0JP3FJ';

console.log(
  '🎬 Maggie automation live with emotion tagging, retries, Telegram reports, and Puppeteer upload.'
);

