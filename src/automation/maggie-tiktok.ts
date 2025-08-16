import axios from 'axios';
import puppeteer from 'puppeteer-core';
import {
  fetchRawFiles, renameFiles, extractEmotionKeywords,
  appendRow, fetchRows, colorCodeRow, renderVideo,
  uploadToTikTok, sendTelegram, findFlops,
  fetchTrending, cleanup
} from './maggie-utils';

import {
  startRawWatcher, startRawTracker, WatcherEnv, schedulePosts,
  SchedulerEnv, startFlopCron, FlopEnv,
  monitorBrowserless, FallbackEnv, syncQueueToFinalFolder
} from './maggie-tasks';
import { getEnv } from '../env.local';

export interface TikTokAutomationEnv extends
  WatcherEnv,
  SchedulerEnv,
  FlopEnv,
  FallbackEnv {
  DRIVE_FOLDER_ID?: string;         // Raw folder
  DRIVE_FINAL_FOLDER_ID?: string;   // Final folder
  SHEET_ID?: string;                // Tracker sheet
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  BROWSERLESS_URL?: string;
}

interface QueueItem {
  id: string;
  filename: string;
  emotion?: string;
  useCapCut?: boolean;
}

class PostQueue {
  private items: QueueItem[] = [];
  private failures: { id: string; ts: number }[] = [];

  constructor(private onRetreat: () => Promise<void>) {}

  enqueue(item: QueueItem) {
    this.items.push(item);
  }

  next(): QueueItem | undefined {
    return this.items.shift();
  }

  get length() {
    return this.items.length;
  }

  markPosted(id: string) {
    console.log(`✅ Posted ${id}`);
    // TODO: update Google Sheet tracker on success
  }

  markFailed(id: string) {
    console.log(`❌ Failed ${id}`);
    this.failures.push({ id, ts: Date.now() });
    this.retreatTrigger();
    // TODO: update Google Sheet tracker on failure
  }

  private async retreatTrigger() {
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - sevenDays;
    const recent = this.failures.filter(f => f.ts >= cutoff);
    if (recent.length >= 3) {
      await this.onRetreat();
      this.failures = [];
    }
  }
}

async function generateCaptionFromEmotion(emotion) {
  const emotionMap = {
    soulful: "When your soul finally says yes 🌿✨",
    funny: "POV: chaos is a lifestyle 🤪",
    validating: "You’re not broken, you’re becoming. 🩵",
    dry: "This is fine. Totally fine. 🔥"
  };
  return emotionMap[emotion] || "Let the universe hold this one.";
}

async function triggerFallback(video: string, reason: string, error: unknown) {
  const url = getEnv('MAKE_FALLBACK_WEBHOOK');
  if (!url) return;
  try {
    await axios.post(url, { video, reason, error: String(error) });
  } catch (err) {
    console.error('Failed to trigger fallback webhook', err);
  }
}

/**
 * MaggieTikTokAutomation orchestrates the end-to-end TikTok pipeline.
 * Methods delegate to specialized modules in this folder.
 */
export class MaggieTikTokAutomation {
  private paused = false;
  private queue = new PostQueue(() => this.retreatMode());
  private overflowSince?: number;

  constructor(private env: TikTokAutomationEnv) {}

  /**
   * 🎥 FOLDER WATCHER
   * Monitor Google Drive folder for new videos and analyze content.
   */
  async watchFolder(): Promise<void> {
    await fetchRawFiles();
    startRawWatcher(this.env);
    startRawTracker(this.env);
    syncQueueToFinalFolder();
  }

  /**
   * 📲 TIKTOK AUTO-SCHEDULER
   * Post videos from the final folder to TikTok.
   */
  async scheduleTikToks(): Promise<void> {
    if (this.paused) {
      console.log('Retreat mode active. Skipping scheduling.');
      return;
    }

    if (this.queue.length > 10) {
      console.log('🔁 Maggie taking a break: queue is full');
      if (this.queue.length > 20) {
        if (!this.overflowSince) this.overflowSince = Date.now();
        else if (Date.now() - this.overflowSince > 60 * 60 * 1000) {
          await sendTelegram(this.env, '⚠️ Queue has over 20 items pending');
          this.overflowSince = Date.now();
        }
      } else {
        this.overflowSince = undefined;
      }
      return;
    }

    const next = this.queue.next();
    if (!next) {
      console.log('No videos queued.');
      return;
    }

    console.log(`📅 Scheduling video: ${next.filename}`);
    let retries = 0;
    while (retries < 3) {
      try {
        const browser = await puppeteer.connect({ browserWSEndpoint: this.env.BROWSERLESS_URL });
        const page = await browser.newPage();
        try {
          await page.goto('https://www.tiktok.com/upload');
          await page.waitForSelector('input[type="file"]', { timeout: 10000 });
        } catch (err) {
          console.error('❌ TikTok upload page failed to load', err);
          await triggerFallback(next.filename, 'tiktok_dom', err);
          retries++;
          await browser.close().catch(() => {});
          if (retries >= 3) {
            await triggerFallback(next.filename, 'retry_failed', err);
            this.queue.markFailed(next.id);
          }
          continue;
        }

        const fileInput = await page.$('input[type="file"]');
        await fileInput.uploadFile(`/mnt/data/raw/${next.filename}`);

        const caption = await generateCaptionFromEmotion(next.emotion || 'validating');

        if (next.useCapCut) {
          try {
            await page.evaluate(() => (window as any).applyCapCut());
          } catch (err) {
            await page.type('textarea[placeholder="Caption"]', `${caption} 😊`);
          }
        } else {
          await page.type('textarea[placeholder="Caption"]', caption);
        }

        await page.click('button:contains("Post")');

        this.queue.markPosted(next.id);
        await page.close();
        await browser.close();
        return;
      } catch (err) {
        console.error('❌ Upload failed:', err);
        await triggerFallback(next.filename, 'puppeteer_crash', err);
        retries++;
        if (retries >= 3) {
          await triggerFallback(next.filename, 'retry_failed', err);
          this.queue.markFailed(next.id);
        }
      }
    }
  }

  /**
   * 📉 FLOP DETECTOR + RECOVERY
   * Recut and repost low performing videos.
   */
  async detectAndRecoverFlops(): Promise<void> {
    startFlopCron(this.env);
    await findFlops();
  }

  /**
   * 🤖 AUTO-SWITCHING
   * Switch to Playwright/Puppeteer if Browserless usage exceeds 75%.
   */
  async autoSwitchRenderer(): Promise<void> {
    await monitorBrowserless(this.env);
  }

  private async retreatMode() {
    this.paused = true;
    await sendTelegram(this.env, '📉 Retreat mode triggered');
  }

  /**
   * Placeholder for other modules like trend insights or Telegram summaries.
   */
  async run(payload: Record<string, any>): Promise<{ ok: boolean }> {
    console.log('✨ Maggie initialized. Ready to post 💫');
    console.log(`Queue: ${this.queue.length} pending. CapCut enabled: ✅`);
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
