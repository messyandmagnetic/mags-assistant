import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import {
  fetchRawFiles, renameFiles, extractEmotionKeywords,
  appendRow, fetchRows, colorCodeRow, renderVideo,
  uploadToTikTok, sendTelegram, findFlops,
  cleanup
} from './maggie-utils';

import {
  startRawWatcher, startRawTracker, WatcherEnv, schedulePosts,
  SchedulerEnv, startFlopCron, FlopEnv,
  monitorBrowserless, FallbackEnv
} from './maggie-tasks';
import { getEnv } from '../lib/getEnv';
import { appendRows, getDrive } from '../../lib/google.js';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
const RETRY_DELAY_MS = Number(process.env.RETRY_DELAY_MS) || 5 * 60 * 1000;

const EMOJI_CAPTIONS: Record<string, string> = {
  joy: '💛✨When your soul lights up for no reason',
  grief: '🖤 Not everything has to be okay today, and that’s okay.',
  silly: '😂 Sometimes healing looks like this.',
};

async function syncEmojiGuide(env: TikTokAutomationEnv) {
  if (!env.SHEET_ID) return;
  const rows = Object.entries(EMOJI_CAPTIONS).map(([e, c]) => [e, c]);
  try {
    await appendRows(env.SHEET_ID, 'Reference!A:B', rows);
  } catch (err) {
    console.error('Failed to sync emoji guide', err);
  }
}

const queuePath = path.join('/tmp', 'queue.json');

interface QueueData {
  items: QueueItem[];
  failures: { id: string; ts: number }[];
}

export function loadQueue(): QueueData {
  if (!fs.existsSync(queuePath)) return { items: [], failures: [] };
  try {
    return JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  } catch {
    return { items: [], failures: [] };
  }
}

export function saveQueue(data: QueueData) {
  try {
    fs.writeFileSync(queuePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to save queue', err);
  }
}

async function generatePreview(env: TikTokAutomationEnv, items: QueueItem[]) {
  const upcoming = items.filter(i => i.status === 'queued').slice(0, 5);
  const rows = upcoming
    .map(i => `<tr><td>${i.filename}</td><td>${i.emotion || ''}</td><td>${i.scheduled || ''}</td><td>${i.caption || ''}</td></tr>`)
    .join('');
  const html = `<!DOCTYPE html><html><body><table><tr><th>File</th><th>Emoji</th><th>Scheduled</th><th>Caption</th></tr>${rows}</table></body></html>`;
  const previewPath = path.join('/tmp', 'schedule-preview.html');
  fs.writeFileSync(previewPath, html);
  if (!env.DRIVE_FINAL_FOLDER_ID) return;
  try {
    const drive = await getDrive();
    await drive.files.create({
      requestBody: { name: 'schedule-preview.html', parents: [env.DRIVE_FINAL_FOLDER_ID] },
      media: { mimeType: 'text/html', body: fs.createReadStream(previewPath) },
    });
  } catch (err) {
    console.error('Failed to upload preview', err);
  }
}

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
  scheduled?: string;
  retries?: number;
  status?: 'queued' | 'processing' | 'failed' | 'posted' | 'flop_final';
  lastError?: string;
}

class PostQueue {
  private items: QueueItem[] = [];
  private failures: { id: string; ts: number }[] = [];
  private consecutiveFails = 0;

  constructor(private env: TikTokAutomationEnv, private onRetreat: () => Promise<void>) {
    const data = loadQueue();
    this.items = data.items || [];
    this.failures = data.failures || [];
  }

  private save() {
    saveQueue({ items: this.items, failures: this.failures });
    generatePreview(this.env, this.items).catch(err => console.error(err));
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
    this.consecutiveFails = 0;
    console.log(`✅ Posted ${item.id}`);
    if (this.env.SHEET_ID) {
      await appendRow({
        spreadsheetId: this.env.SHEET_ID,
        values: [item.filename, new Date().toISOString(), '✅ posted', item.caption || '', item.emotion || '', !!item.useCapCut, false],
      });
    }
    this.save();
    await sendTelegram(this.env, `🎥 New TikTok uploaded: ${item.filename}`);
  }

  async markFailed(item: QueueItem, flopDetected = false, reason = 'unknown') {
    item.status = 'failed';
    item.lastError = reason;
    item.retries = (item.retries || 0) + 1;
    this.update(item);
    this.consecutiveFails++;
    console.log(`❌ Failed ${item.id}: ${reason}`);
    this.failures.push({ id: item.id, ts: Date.now() });
    if (this.env.SHEET_ID) {
      await appendRow({
        spreadsheetId: this.env.SHEET_ID,
        values: [item.filename, new Date().toISOString(), '❌ failed', item.caption || '', item.emotion || '', !!item.useCapCut, flopDetected],
      });
    }
    this.save();
    if (item.retries < 3) {
      setTimeout(() => {
        item.status = 'queued';
        this.update(item);
        this.save();
      }, RETRY_DELAY_MS);
      await sendTelegram(this.env, `🔁 Retry triggered for ${item.filename}`);
    } else {
      await sendTelegram(this.env, `Upload failed for ${item.filename}`);
      if (this.env.MAKE_FALLBACK_WEBHOOK) {
        try {
          await axios.post(this.env.MAKE_FALLBACK_WEBHOOK, { type: 'fail', video: item.filename });
        } catch (err) {
          console.error('Fallback webhook failed', err);
        }
      }
    }
    if (item.retries >= 3 || this.consecutiveFails >= 3) {
      await this.onRetreat();
    }
  }
}

async function generateCaptionFromEmotion(emotion?: string): Promise<string> {
  if (!emotion) return 'Let the universe hold this one.';
  return EMOJI_CAPTIONS[emotion] || 'Let the universe hold this one.';
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
    syncEmojiGuide(this.env);
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
    await sendTelegram(this.env, '🌙 Maggie has entered fallback retreat mode.');
    await sendTelegram(this.env, '💤 Maggie is taking a break to recharge. She’ll be back soon.');
    setTimeout(() => {
      this.paused = false;
    }, 12 * 60 * 60 * 1000);
  }

  private async checkFlop(item: QueueItem) {
    await delay(60 * 60 * 1000);
    const stats = await fetchTikTokStats(item.id);
    if (stats.views < 100) {
      if ((item.retries || 0) < 3) {
        item.retries = (item.retries || 0) + 1;
        item.caption = await generateCaptionFromEmotion(item.emotion);
        await renderVideo();
        this.queue.enqueue(item);
      } else {
        await this.queue.markFailed(item, true, 'flop');
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
