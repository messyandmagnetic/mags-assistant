import { google } from 'googleapis';

const DRIVE_FOLDERS: Record<string, string> = {
  RAW_FOLDER_ID: 'TikTok – Raw Videos',
  WORK_FOLDER_ID: 'TikTok – Workbench',
  FINAL_FOLDER_ID: 'TikTok – Final',
  COVERS_FOLDER_ID: 'TikTok – Covers',
  BROLL_FOLDER_ID: 'TikTok – B-Roll',
};

interface StatusReport {
  DRIVE_STATUS: string;
  SHEETS_STATUS: string;
  TIKTOK_STATUS: string;
  CAPCUT_STATUS: string;
}

async function checkDrive(auth: any): Promise<string> {
  const drive = google.drive({ version: 'v3', auth });
  try {
    for (const [envKey] of Object.entries(DRIVE_FOLDERS)) {
      const id = process.env[envKey] || '';
      if (!id) continue;
      await drive.files.list({ q: `'${id}' in parents and trashed = false`, pageSize: 1 });
    }
    return 'ok';
  } catch (err: any) {
    if (err?.code === 'ENOTFOUND') return 'offline';
    return `no_access:${err?.message || 'unknown'}`;
  }
}

async function checkSheets(auth: any): Promise<string> {
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) return 'missing';
  const sheets = google.sheets({ version: 'v4', auth });
  try {
    await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    return 'ok';
  } catch (err: any) {
    if (err?.code === 'ENOTFOUND') return 'offline';
    return 'no_access';
  }
}

async function checkTikTok(): Promise<string> {
  if (process.env.SCHEDULER !== 'tiktok_api') return 'skipped';
  if (!process.env.TIKTOK_ACCESS_TOKEN) return 'token_missing';
  try {
    const res = await fetch('https://open.tiktokapis.com/v2/user/info/', {
      headers: { Authorization: `Bearer ${process.env.TIKTOK_ACCESS_TOKEN}` },
    });
    if (!res.ok) return `error:${res.status}`;
    return 'ok';
  } catch (err) {
    return 'offline';
  }
}

async function checkCapCut(): Promise<string> {
  if (!process.env.CAPCUT_TEMPLATE_IDS) return 'not_configured';
  try {
    const res = await fetch('https://open.capcutapi.com/v1/template/list');
    return res.ok ? 'ok' : `error:${res.status}`;
  } catch (err) {
    return 'offline';
  }
}

async function writeStatusReport(auth: any, report: StatusReport) {
  if (!auth || !process.env.SHEET_ID) return;
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.SHEET_ID!;
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const titles = (meta.data.sheets || []).map((s) => s.properties?.title);
    if (!titles.includes('STATUS_REPORT')) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: 'STATUS_REPORT' } } }] },
      });
    }
    const rows = Object.entries(report).map(([k, v]) => [k, v]);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'STATUS_REPORT!A1',
      valueInputOption: 'RAW',
      requestBody: { values: rows },
    });
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'Needs Attention'!A:E`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          ['', '', 'connectivity_check', JSON.stringify(report), new Date().toISOString()],
        ],
      },
    });
  } catch (err) {
    console.error('[status_report]', err);
  }
}

async function main() {
  const report: StatusReport = {
    DRIVE_STATUS: 'skipped',
    SHEETS_STATUS: 'skipped',
    TIKTOK_STATUS: 'skipped',
    CAPCUT_STATUS: 'skipped',
  };
  if (process.env.OFFLINE_MODE === 'true') {
    console.log('Offline mode — skipping external calls.');
    report.DRIVE_STATUS = 'offline';
    report.SHEETS_STATUS = 'offline';
    report.TIKTOK_STATUS = 'offline';
    report.CAPCUT_STATUS = 'offline';
    console.log(report);
    return;
  }
  const auth = await google.auth.getClient({
    scopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/spreadsheets',
    ],
  });
  report.DRIVE_STATUS = await checkDrive(auth);
  report.SHEETS_STATUS = await checkSheets(auth);
  report.TIKTOK_STATUS = await checkTikTok();
  report.CAPCUT_STATUS = await checkCapCut();
  console.log(report);
  await writeStatusReport(auth, report);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
