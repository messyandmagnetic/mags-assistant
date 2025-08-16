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
import { localEnv, getEnv } from '../env.local';

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
  status?: 'queued' | 'processing' | 'failed' | 'posted' | 'flop_final';
  lastError?: string;
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

  save() {
    try {
      fs.writeFileSync(this.file, JSON.stringify({ items: this.items, failures: this.failures }, null, 2));
    } catch (err) {
      console.error('Failed to save queue', err);
    }
  }

  enqueue(item: QueueItem) {
    item.status = 'queued';
    this.items.push(item);
    this.save();
  }

  next(): QueueItem | undefined {
    const idx = this.items.findIndex(i => i.status === 'queued');
    if (idx === -1) return undefined;
    const item = this.items[idx];
    item.status = 'processing';
    this.save();
    return item;
  }

  update(item: QueueItem) {
    const idx = this.items.findIndex(i => i.id === item.id);
    if (idx >= 0) this.items[idx] = item;
  }

  async markPosted(item: QueueItem) {
    item.status = 'posted';
    this.update(item);
    console.log(`✅ Posted ${item.id}`);
    await appendRow({
      spreadsheetId: this.env.SHEET_ID,
      values: [item.filename, new Date().toISOString(), 'posted', item.caption || '', item.emotion || '', !!item.useCapCut, false],
    });
    try {
      fs.renameSync(`/mnt/data/raw/${item.filename}`, `/mnt/data/done/${item.filename}`);
    } catch (err) {
      console.error('Failed to move file to done folder', err);
    }
    this.save();
  }

  async markFailed(item: QueueItem, flopDetected = false, reason = 'unknown') {
    item.status = 'failed';
    item.lastError = reason;
    item.retries = (item.retries || 0) + 1;
    this.update(item);
    console.log(`❌ Failed ${item.id}: ${reason}`);
    this.failures.push({ id: item.id, ts: Date.now() });
    await appendRow({
      spreadsheetId: this.env.SHEET_ID,
      values: [item.filename, new Date().toISOString(), 'FAILED ❌', item.caption || '', item.emotion || '', !!item.useCapCut, flopDetected],
    });
    this.save();
    if (item.retries >= 3) {
      await sendTelegram(this.env, `Upload failed (${reason}) for ${item.filename}`);
      if (this.env.MAKE_FALLBACK_WEBHOOK) {
        try {
          await axios.post(this.env.MAKE_FALLBACK_WEBHOOK, { type: 'fail', video: item.filename });
        } catch (err) {
          console.error('Fallback webhook failed', err);
        }
      } else {
        await globalThis.codex?.tasks?.retryPostQueue?.();
        await globalThis.codex?.tasks?.notifyViaTelegram?.(`Upload failed for ${item.filename}`);
      }
    }
    await this.retreatTrigger();
  }

  retryFailed() {
    for (const item of this.items.filter(i => i.status === 'failed' && (i.retries || 0) < 3)) {
      const delayMs = Math.pow(2, item.retries || 0) * 60 * 1000;
      setTimeout(() => {
        item.status = 'queued';
        this.update(item);
        this.save();
      }, delayMs);
    }
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

async function generateCaptionFromEmotion(emotion: string): Promise<string> {
  if (emotion === 'random') {
    const list = (await fetchTrending()) as string[];
    emotion = list[Math.floor(Math.random() * list.length)] || 'funny';
  }
  const emotionMap: Record<string, string> = {
    validating: 'Overstimulated? Same \uD83D\uDC80',
    funny: 'This is your sign to *not* parent gently today \uD83D\uDE05',
    playful: 'POV: the farm is healing you but the kids are feral',
  };
  return emotionMap[emotion] || 'Let the universe hold this one.';
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
    this.queue.retryFailed();
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
      await sendTelegram(this.env, 'Queue is empty');
      return;
    }

    console.log(`📅 Scheduling video: ${next.filename}`);

    if (next.filename.includes('_nocap')) {
      next.caption = '';
    } else if (!next.caption && next.emotion) {
      next.caption = await generateCaptionFromEmotion(next.emotion);
    }

    let browser;
    let page;
    try {
      browser = await puppeteer.connect({ browserWSEndpoint: this.env.BROWSERLESS_URL });
      page = await browser.newPage();
    } catch (err) {
      await this.queue.markFailed(next, false, 'launch');
      await delay(30 * 1000);
      await this.scheduleTikToks();
      return;
    }

    try {
      await page.goto('https://www.tiktok.com/upload');
    } catch (err) {
      await this.queue.markFailed(next, false, 'navigation');
      await browser.close();
      await delay(30 * 1000);
      await this.scheduleTikToks();
      return;
    }

    try {
      await page.waitForSelector('input[type="file"]');
      const fileInput = await page.$('input[type="file"]');
      await fileInput.uploadFile(`/mnt/data/raw/${next.filename}`);
    } catch (err) {
      await this.queue.markFailed(next, false, 'upload');
      await browser.close();
      await delay(30 * 1000);
      await this.scheduleTikToks();
      return;
    }

    try {
      if (next.caption) {
        await page.type('textarea[placeholder="Caption"]', next.caption);
      }
    } catch (err) {
      await this.queue.markFailed(next, false, 'caption');
      await browser.close();
      await delay(30 * 1000);
      await this.scheduleTikToks();
      return;
    }

    if (next.useCapCut) {
      try {
        await page.click('button[data-e2e="capcut"]');
      } catch (err) {
        await this.queue.markFailed(next, false, 'capcut');
        await browser.close();
        await delay(30 * 1000);
        await this.scheduleTikToks();
        return;
      }
    }

    try {
      await page.click('button:contains("Post")');
    } catch (err) {
      await this.queue.markFailed(next, false, 'post');
      await browser.close();
      await delay(30 * 1000);
      await this.scheduleTikToks();
      return;
    }

    await this.queue.markPosted(next);
    await page.close();
    await browser.close();
    await this.checkFlop(next);

    await delay(30 * 1000);
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
    await sendTelegram(this.env, '📉 Retreat mode triggered');
  }

  private async checkFlop(item: QueueItem) {
    await delay(60 * 60 * 1000);
    const stats = await fetchTikTokStats(item.id);
    if (stats.views < 100) {
      if ((item.retries || 0) < 3) {
        item.retries = (item.retries || 0) + 1;
        item.emotion = 'random';
        item.caption = await generateCaptionFromEmotion('random');
        await renderVideo();
        this.queue.enqueue(item);
      } else {
        item.status = 'flop_final';
        this.queue.update(item);
        await sendTelegram(this.env, `Final flop: ${item.filename}`);
        this.queue.save();
      }
    }
  }

  /**
   * Placeholder for other modules like trend insights or Telegram summaries.
   */
  async run(payload: Record<string, any>): Promise<{ ok: boolean }> {
    await fetchRows();
    this.watchFolder();
    await this.scheduleTikToks();
    await this.detectAndRecoverFlops();
    await this.autoSwitchRenderer();
    return { ok: true };
  }
}

async function fetchTikTokStats(id: string): Promise<{ views: number }> {
  console.log('fetchTikTokStats placeholder for', id);
  return { views: 0 };
}

export async function retryPostQueue() {
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
  await maggie.scheduleTikToks();
}

export async function runMaggieTikTokLoop(payload: Record<string, any>, env: TikTokAutomationEnv = {} as TikTokAutomationEnv) {
  const mergedEnv: TikTokAutomationEnv = {
    TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN || await getEnv('TELEGRAM_BOT_TOKEN'),
    TELEGRAM_CHAT_ID: env.TELEGRAM_CHAT_ID || await getEnv('TELEGRAM_CHAT_ID'),
    SHEET_ID: env.SHEET_ID || await getEnv('SHEET_ID'),
    DRIVE_FOLDER_ID: env.DRIVE_FOLDER_ID || await getEnv('DRIVE_FOLDER_ID'),
    DRIVE_FINAL_FOLDER_ID: env.DRIVE_FINAL_FOLDER_ID || await getEnv('DRIVE_FINAL_FOLDER_ID'),
    BROWSERLESS_URL: env.BROWSERLESS_URL || await getEnv('BROWSERLESS_URL'),
    MAKE_FALLBACK_WEBHOOK: env.MAKE_FALLBACK_WEBHOOK || await getEnv('MAKE_FALLBACK_WEBHOOK'),
  };
  validateEnv(mergedEnv);
  const maggie = new MaggieTikTokAutomation(mergedEnv);
  return maggie.run(payload);
}
