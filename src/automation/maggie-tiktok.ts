import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import {
  fetchRawFiles, renameFiles, extractEmotionKeywords,
  appendRow, fetchRows, colorCodeRow, renderVideo,
  uploadToTikTok, sendTelegram, findFlops,
  fetchTrending, cleanup
} from './maggie-utils';

import {
  startRawWatcher, startRawTracker, WatcherEnv, schedulePosts,
  SchedulerEnv, startFlopCron, FlopEnv,
  monitorBrowserless, FallbackEnv
} from './maggie-tasks';
import { localEnv } from '../env.local';
import { getEnv } from '../lib/get-env';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

function validateEnv(env: TikTokAutomationEnv) {
  const required = [
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID',
    'SHEET_ID',
    'DRIVE_FOLDER_ID',
    'DRIVE_FINAL_FOLDER_ID',
    'BROWSERLESS_URL',
  ] as const;
  for (const key of required) {
    if (!(env as any)[key]) {
      throw new Error(`Missing env var: ${key}`);
    }
  }
}

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
  MAKE_FALLBACK_WEBHOOK?: string;
}

interface QueueItem {
  id: string;
  filename: string;
  emotion?: string;
  useCapCut?: boolean;
  caption?: string;
  retries?: number;
}

class PostQueue {
  private file = path.resolve('queue.json');
  private items: QueueItem[] = [];
  private failures: { id: string; ts: number }[] = [];

  constructor(private env: TikTokAutomationEnv, private onRetreat: () => Promise<void>) {
    this.load();
  }

  private load() {
    if (!fs.existsSync(this.file)) return;
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.items = data.items || [];
      this.failures = data.failures || [];
    } catch (err) {
      console.error('Failed to load queue', err);
    }
  }

  private save() {
    try {
      fs.writeFileSync(this.file, JSON.stringify({ items: this.items, failures: this.failures }, null, 2));
    } catch (err) {
      console.error('Failed to save queue', err);
    }
  }

  enqueue(item: QueueItem) {
    this.items.push(item);
    this.save();
  }

  next(): QueueItem | undefined {
    const item = this.items.shift();
    this.save();
    return item;
  }

  async markPosted(item: QueueItem) {
    console.log(`✅ Posted ${item.id}`);
    await appendRow({
      spreadsheetId: this.env.SHEET_ID,
      values: [item.filename, new Date().toISOString(), 'posted', item.caption || '', item.emotion || '', !!item.useCapCut, false],
    });
    this.save();
  }

  async markFailed(item: QueueItem, flopDetected = false) {
    console.log(`❌ Failed ${item.id}${flopDetected ? ' (flop_final)' : ''}`);
    this.failures.push({ id: item.id, ts: Date.now() });
    await appendRow({
      spreadsheetId: this.env.SHEET_ID,
      values: [
        item.filename,
        new Date().toISOString(),
        flopDetected ? 'flop_final' : 'failed',
        item.caption || '',
        item.emotion || '',
        !!item.useCapCut,
        flopDetected,
      ],
    });
    this.save();
    this.retreatTrigger();
  }

  private async retreatTrigger() {
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - sevenDays;
    const recent = this.failures.filter(f => f.ts >= cutoff);
    if (recent.length >= 3) {
      await this.onRetreat();
      this.failures = [];
      this.save();
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
  private paused = false;
  private queue: PostQueue;

  constructor(private env: TikTokAutomationEnv) {
    this.queue = new PostQueue(this.env, () => this.retreatMode());
  }

  /**
   * 🎥 FOLDER WATCHER
   * Monitor Google Drive folder for new videos and analyze content.
   */
  async watchFolder(): Promise<void> {
    await fetchRawFiles();
    startRawWatcher(this.env);
    startRawTracker(this.env);
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

    const next = this.queue.next();
    if (!next) {
      console.log('No videos queued.');
      return;
    }

    console.log(`📅 Scheduling video: ${next.filename}`);

    next.retries = next.retries || 0;
    if (next.filename.includes('_nocap')) {
      next.caption = '';
    } else if (!next.caption && next.emotion) {
      if (next.emotion === 'random') {
        next.caption = await generateCaptionFromEmotion(['soulful', 'funny', 'validating', 'dry'][Math.floor(Math.random()*4)]);
      } else {
        next.caption = await generateCaptionFromEmotion(next.emotion);
      }
    }

    const attempt = next.retries;

    const upload = async (): Promise<boolean> => {
      let browser;
      let page;
      // Puppeteer launch
      try {
        browser = await puppeteer.connect({ browserWSEndpoint: this.env.BROWSERLESS_URL });
        page = await browser.newPage();
      } catch (err) {
        console.error('Launch failed', err);
        await this.queue.markFailed(next, attempt >= 2);
        return false;
      }

      // File upload
      try {
        await page.goto('https://www.tiktok.com/upload');
        await page.waitForSelector('input[type="file"]');
        const fileInput = await page.$('input[type="file"]');
        await fileInput.uploadFile(`/mnt/data/raw/${next.filename}`);
      } catch (err) {
        console.error('Upload failed', err);
        await this.queue.markFailed(next, attempt >= 2);
        await browser.close();
        return false;
      }

      // Caption write
      try {
        if (next.caption) {
          await page.type('textarea[placeholder="Caption"]', next.caption);
        }
      } catch (err) {
        console.error('Caption failed', err);
        await this.queue.markFailed(next, attempt >= 2);
        await browser.close();
        return false;
      }

      // Toggle CapCut if needed
      if (next.useCapCut) {
        try {
          await page.click('button[data-e2e="capcut"]');
        } catch (err) {
          console.error('CapCut toggle failed', err);
          await this.queue.markFailed(next, attempt >= 2);
          await browser.close();
          return false;
        }
      }

      // Press Post
      try {
        await page.click('button:contains("Post")');
      } catch (err) {
        console.error('Post click failed', err);
        await this.queue.markFailed(next, attempt >= 2);
        await browser.close();
        return false;
      }

      await this.queue.markPosted(next);
      await page.close();
      await browser.close();
      return true;
    };

    const ok = await upload();
    if (!ok) {
      if (attempt < 3) {
        next.retries = attempt + 1;
        const backoff = Math.pow(2, attempt) * 10 * 60 * 1000;
        console.log(`Retrying ${next.filename} in ${backoff / 60000} minutes`);
        setTimeout(() => this.queue.enqueue(next), backoff);
      } else {
        await this.queue.markFailed(next, true);
        await sendTelegram(this.env, `flop_final: ${next.filename}`);
        if (this.env.MAKE_FALLBACK_WEBHOOK) {
          try {
            await axios.post(this.env.MAKE_FALLBACK_WEBHOOK, { type: 'flop_final', video: next.filename });
          } catch (err) {
            console.error('Fallback webhook failed', err);
          }
        } else {
          console.warn('Make down? Triggering Codex fallback');
        }
      }
    }

    await delay(60 * 1000);
    await this.scheduleTikToks();
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
    ;(global as any).maggie = { status: 'resting' };
    await sendTelegram(this.env, '📉 Retreat mode triggered');
    try {
      // @ts-ignore codex task
      await (global as any).codex?.tasks?.healMaggie?.();
    } catch {}
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

export async function runMaggieTikTokLoop(payload: Record<string, any>, env: TikTokAutomationEnv = {} as TikTokAutomationEnv) {
  const mergedEnv: TikTokAutomationEnv = {
    TELEGRAM_BOT_TOKEN: getEnv('TELEGRAM_BOT_TOKEN', env),
    TELEGRAM_CHAT_ID: getEnv('TELEGRAM_CHAT_ID', env),
    SHEET_ID: getEnv('SHEET_ID', env),
    DRIVE_FOLDER_ID: getEnv('DRIVE_FOLDER_ID', env),
    DRIVE_FINAL_FOLDER_ID: getEnv('DRIVE_FINAL_FOLDER_ID', env),
    BROWSERLESS_URL: getEnv('BROWSERLESS_URL', env),
    MAKE_FALLBACK_WEBHOOK: getEnv('MAKE_FALLBACK_WEBHOOK', env),
  };
  validateEnv(mergedEnv);
  const maggie = new MaggieTikTokAutomation(mergedEnv);
  return maggie.run(payload);
}

export async function deployTikTokBot(payload: Record<string, any>, env: TikTokAutomationEnv = {} as TikTokAutomationEnv) {
  return runMaggieTikTokLoop(payload, env);
}

export async function completeMaggieSync(payload: Record<string, any>, env: TikTokAutomationEnv = {} as TikTokAutomationEnv) {
  return deployTikTokBot(payload, env);
}
