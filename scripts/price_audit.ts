import { getSheets } from '../lib/google.js';
import { env } from '../lib/env.js';
import { log } from '../lib/logger.js';

export async function runPriceAudit() {
  const sheetId = env.MASTER_MEMORY_SHEET_ID;
  if (!sheetId) {
    console.error('Missing MASTER_MEMORY_SHEET_ID');
    return 0;
  }
  await log('price_audit', 'start');
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Stripe_Catalog!A:Z',
  });
  const rows = res.data.values || [];
  console.log(`Loaded ${rows.length} catalog rows`);
  return rows.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runPriceAudit();
}
