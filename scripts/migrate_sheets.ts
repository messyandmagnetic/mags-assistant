import { CANONICAL_COLUMNS, HEADING_MAP, normalizeSubmission } from '../worker/lib/schema';
import { ensureHeaders, upsertRow, findRowBySubmissionId, Env as SheetsEnv } from '../worker/lib/sheets';
import { SHEET_ID_QUIZ, SHEET_ID_FEEDBACK } from '../worker/lib/config';

interface Env extends SheetsEnv {}

async function migrateSheet(env: Env, sheetId: string) {
  const backupName = `_BACKUP_${new Date().toISOString().replace(/[:T]/g, '').slice(0, 12)}`;
  console.log(`Backing up to ${backupName}`);
  // Backup via Sheets API copyTo (not implemented here)
  // TODO: implement backup copy

  await ensureHeaders(env, sheetId, 'Submissions_Clean', CANONICAL_COLUMNS);

  // TODO: read existing rows and migrate to canonical schema
  console.log('Migration logic placeholder');
}

export async function main(env: Env) {
  await migrateSheet(env, SHEET_ID_QUIZ);
  await migrateSheet(env, SHEET_ID_FEEDBACK);
}

if (require.main === module) {
  main(process.env as any).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
