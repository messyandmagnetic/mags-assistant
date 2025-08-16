import cron from 'node-cron';
import { getSheets } from '../../lib/google.js';
import { sendEmail } from '../../lib/gmail.ts';
import { tgSend } from '../../lib/telegram.ts';
import { getEnv } from '../env.local';

export interface SoulOrderEnv {
  SHEET_ID?: string; // Spreadsheet ID for "Soul Blueprint Orders – Messy & Magnetic™"
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

const SHEET_NAME = 'Soul Blueprint Orders – Messy & Magnetic™';
const LOG_SHEET = 'Maggie Logs';

/**
 * startSoulOrderWatcher polls the orders sheet every 5 minutes.
 * New rows trigger a Telegram alert and confirmation email, then mark Status as processed.
 */
export function startSoulOrderWatcher(env: SoulOrderEnv) {
  cron.schedule('*/5 * * * *', () => processOrders(env));
}

async function processOrders(env: SoulOrderEnv) {
  if (!env.SHEET_ID) return;
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: env.SHEET_ID,
    range: `${SHEET_NAME}!A:Z`,
  });
  const rows: string[][] = res.data.values || [];
  const headers = rows[0] || [];
  const nameIdx = headers.indexOf('Name');
  const emailIdx = headers.indexOf('Email');
  const productIdx = headers.indexOf('Product');
  const statusIdx = headers.indexOf('Status');
  const updates: { range: string; values: string[][] }[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if ((row[statusIdx] || '').trim()) continue;
    const name = row[nameIdx];
    const email = row[emailIdx];
    const product = row[productIdx];
    await notifyTelegram(name, product, env.SHEET_ID);
    await sendConfirmation(email, name, product, env.SHEET_ID);
    updates.push({
      range: `${SHEET_NAME}!${columnLetter(statusIdx)}${i + 1}`,
      values: [['✅']],
    });
  }

  if (updates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: env.SHEET_ID,
      requestBody: { data: updates, valueInputOption: 'USER_ENTERED' },
    });
  }
}

async function notifyTelegram(name: string, product: string, sheetId?: string) {
  try {
    await tgSend(`🔮 New Soul Blueprint for ${name} – ${product}`);
  } catch (err: any) {
    await logError(sheetId, 'telegram', String(err));
  }
}

async function sendConfirmation(email: string, name: string, product: string, sheetId?: string) {
  try {
    await sendEmail({
      to: email,
      subject: 'Your Soul Blueprint is on the way 🌟',
      text: `Hi ${name}, thank you for ordering a ${product} Soul Reading! Maggie is crafting your blueprint now, and you’ll receive it soon. xx – C`,
    });
  } catch (err: any) {
    await logError(sheetId, 'email', String(err));
  }
}

async function logError(sheetId: string | undefined, source: string, message: string) {
  try {
    const sheets = await getSheets();
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId || getEnv('SHEET_ID'),
      range: `${LOG_SHEET}!A:C`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[new Date().toISOString(), source, message]] },
    });
  } catch (e) {
    console.error('Failed to log error', e);
  }
}

function columnLetter(idx: number): string {
  let n = idx + 1;
  let s = '';
  while (n > 0) {
    const mod = (n - 1) % 26;
    s = String.fromCharCode(65 + mod) + s;
    n = Math.floor((n - mod) / 26);
  }
  return s;
}

