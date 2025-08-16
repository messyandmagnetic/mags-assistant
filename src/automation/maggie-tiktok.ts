import { startRawWatcher, WatcherEnv } from './watch-raw';
import { schedulePosts, SchedulerEnv } from './schedule-tiktok';
import { startFlopCron, FlopEnv } from './flop-cron';
import { monitorBrowserless, FallbackEnv } from './fallback-monitor';

export interface TikTokAutomationEnv extends WatcherEnv, SchedulerEnv, FlopEnv, FallbackEnv {}

/**
 * MaggieTikTokAutomation orchestrates the end-to-end TikTok pipeline.
 * Methods delegate to specialized modules in this folder.
 */
export class MaggieTikTokAutomation {
  constructor(private env: TikTokAutomationEnv) {}

  /**
   * 🎥 FOLDER WATCHER
   * Monitor Google Drive folder for new videos and analyze content.
   */
  async watchFolder(): Promise<void> {
    startRawWatcher(this.env);
  }

  /**
   * 📲 TIKTOK AUTO-SCHEDULER
   * Post videos from the final folder to TikTok.
   */
  async scheduleTikToks(): Promise<void> {
    await schedulePosts(this.env);
  }

  /**
   * 📉 FLOP DETECTOR + RECOVERY
   * Recut and repost low performing videos.
   */
  async detectAndRecoverFlops(): Promise<void> {
    startFlopCron(this.env);
  }

  /**
   * 🤖 AUTO-SWITCHING
   * Switch to Playwright/Puppeteer if Browserless usage exceeds 75%.
   */
  async autoSwitchRenderer(): Promise<void> {
    await monitorBrowserless(this.env);
  }

  /**
   * Placeholder for other modules like trend insights or Telegram summaries.
   */
  async run(payload: Record<string, any>): Promise<{ ok: boolean }> {
    this.watchFolder();
    await this.scheduleTikToks();
    await this.detectAndRecoverFlops();
    await this.autoSwitchRenderer();
    return { ok: true };
  }
}

export async function runMaggieTikTokLoop(payload: Record<string, any>, env: TikTokAutomationEnv) {
  const maggie = new MaggieTikTokAutomation(env);
  return maggie.run(payload);
}
