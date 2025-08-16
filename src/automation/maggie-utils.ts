import fetch from 'node-fetch';
import { appendRows } from '../../lib/google.js';

export async function fetchRawFiles() {
  console.log('fetchRawFiles placeholder');
}

export async function renameFiles() {
  console.log('renameFiles placeholder');
}

export async function extractEmotionKeywords() {
  console.log('extractEmotionKeywords placeholder');
}

export async function appendRow({ spreadsheetId, values }: { spreadsheetId?: string; values: any[] }) {
  if (!spreadsheetId) {
    console.warn('No spreadsheetId provided for appendRow');
    return;
  }
  try {
    await appendRows(spreadsheetId, 'Sheet1!A:G', [values]);
  } catch (err) {
    console.error('Failed to append row', err);
  }
}

export async function fetchRows() {
  console.log('fetchRows placeholder');
}

export async function colorCodeRow() {
  console.log('colorCodeRow placeholder');
}

export async function renderVideo() {
  console.log('renderVideo placeholder');
}

export async function uploadToTikTok() {
  console.log('uploadToTikTok placeholder');
}

export async function sendTelegram(env: { TELEGRAM_BOT_TOKEN?: string; TELEGRAM_CHAT_ID?: string }, text: string) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.log('Telegram env missing');
    return;
  }
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body = { chat_id: env.TELEGRAM_CHAT_ID, text };
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    console.error('Failed to send Telegram message');
  }
}

export async function findFlops() {
  console.log('findFlops placeholder');
  return [] as string[];
}

export async function fetchTrending() {
  console.log('fetchTrending placeholder');
  return [] as string[];
}

export async function cleanup() {
  console.log('cleanup placeholder');
}
