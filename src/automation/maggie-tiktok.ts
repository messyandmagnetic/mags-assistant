import puppeteer from 'puppeteer-core';
import axios from 'axios';
import { startRawWatcher, WatcherEnv } from './watch-raw';
import { startFlopCron, FlopEnv } from './flop-cron';
import { monitorBrowserless, FallbackEnv } from './fallback-monitor';

export interface TikTokAutomationEnv extends WatcherEnv, FlopEnv, FallbackEnv {}

interface QueueItem {
  id: string;
  filename: string;
  emotion?: string;
  useCapCut?: boolean;
}

async function sendTelegram(text: string) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return;
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  await axios.post(url, { chat_id: process.env.TELEGRAM_CHAT_ID, text }).catch(console.error);
}

class PostQueue {
  private items: QueueItem[] = [];
  private flopTracker: Record<string, number> = {};
  private retreatMode = false;

  next(): QueueItem | undefined {
    return this.items.shift();
  }

  markPosted(id: string) {
    console.log(`✅ Posted ${id}`);
    // TODO: update Google Sheet tracker on success
  }

  markFailed(id: string) {
    console.log(`❌ Failed ${id}`);
    this.flopTracker[id] = (this.flopTracker[id] || 0) + 1;
    if (this.flopTracker[id] >= 3 && !this.retreatMode) {
      this.retreatTrigger(id);
    }
    // TODO: update Google Sheet tracker on failure
  }

  retreatTrigger(id: string) {
    this.retreatMode = true;
    console.warn(`🚨 Retreat mode triggered due to flops on ${id}`);
    this.items = []; // Pause new uploads

    const msg = `📉 Maggie paused after 3 flops on ${id}. Manual check recommended.`;

    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      sendTelegram(msg);
    }

    if (process.env.MAKE_RETREAT_WEBHOOK) {
      axios
        .post(process.env.MAKE_RETREAT_WEBHOOK, {
          type: 'retreat',
          video: id,
          reason: 'flop-detected',
        })
        .catch(console.error);
    }
  }

  resumeQueue() {
    this.retreatMode = false;
    console.log(`✅ Maggie resumed from retreat mode`);
    sendTelegram?.('🔁 Maggie resumed after retreat mode.');
  }

  checkVideoStatsAndResume(id: string, views: number) {
    if (this.retreatMode && views > 500) {
      console.log(`🎯 Video ${id} got ${views} views — resuming Maggie`);
      this.resumeQueue();
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

/**
 * MaggieTikTokAutomation orchestrates the end-to-end TikTok pipeline.
 * Methods delegate to specialized modules in this folder.
 */
export class MaggieTikTokAutomation {
  private queue = new PostQueue();

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
    const next = this.queue.next();
    if (!next) {
      console.log('No videos queued.');
      return;
    }

    console.log(`📅 Scheduling video: ${next.filename}`);

    try {
      const browser = await puppeteer.connect({ browserWSEndpoint: process.env.BROWSERLESS_URL });
      const page = await browser.newPage();

      await page.goto("https://www.tiktok.com/upload");
      await page.waitForSelector('input[type="file"]');

      // Upload video from local or mounted folder
      const fileInput = await page.$('input[type="file"]');
      await fileInput.uploadFile(`/mnt/data/raw/${next.filename}`);

      // Auto-caption
      const caption = await generateCaptionFromEmotion(next.emotion || "validating");
      await page.type('textarea[placeholder="Write a caption"]', caption);

      // Emoji overlay or CapCut template flag
      if (next.useCapCut) {
        await page.evaluate(() => alert("Reminder: apply CapCut template before posting."));
      }

      // Post now or click Schedule if enabled
      await page.click('button:contains("Post")');

      this.queue.markPosted(next.id);
      await page.close();
      await browser.close();

    } catch (err) {
      console.error("❌ Upload failed:", err);
      this.queue.markFailed(next.id);
    }
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
