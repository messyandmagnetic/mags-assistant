import { google } from 'googleapis';

const SHEET_ID = process.env.SHEET_ID || '';

const REQUIRED_TABS: Record<string, string[]> = {
  Posts: [
    'file_name',
    'drive_file_id',
    'status(queued|editing|ready|scheduled|posted|error|skip)',
    'category(light|funny|emotional)',
    'narrative_hook',
    'caption',
    'hashtags',
    'cover_text',
    'audio_choice(trending|original|library)',
    'audio_title',
    'audio_id',
    'scheduled_date',
    'scheduled_time',
    'tiktok_url',
    'notes',
    'duration_sec',
    'aspect_ratio',
    'checksum_md5',
    'clip_index',
    'series_id',
    'created_at',
    'updated_at',
    'score',
    'reason_selected',
  ],
  Trends: [
    'captured_at',
    'trend_type(sound|format|challenge|effect|topic)',
    'name',
    'platform',
    'region',
    'est_velocity',
    '7d_growth',
    'median_duration_sec',
    'exemplar_links(csv)',
    'usage_count',
    'niche_fit_score',
    'recommended_use_case',
    'peak_windows(local)',
    'confidence(0-1)',
  ],
  CreatorsToWatch: ['handle', 'platform', 'min_followers', 'last_checked', 'notes'],
  Timeslots: ['day_of_week', 'slot_time(HH:mm)', 'priority(1 best)', 'hard_lock(true/false)'],
  Performance: [
    'post_id',
    'posted_at',
    'views',
    'likes',
    'comments',
    'saves',
    'completion_rate',
    'avg_watch_time',
    'hook_retention_3s',
    'outcome',
  ],
  'Needs Attention': ['file_name', 'drive_file_id', 'reason', 'details', 'created_at'],
};

const DRIVE_FOLDERS: Record<string, string> = {
  RAW_FOLDER_ID: 'TikTok – Raw Videos',
  WORK_FOLDER_ID: 'TikTok – Workbench',
  FINAL_FOLDER_ID: 'TikTok – Final',
  COVERS_FOLDER_ID: 'TikTok – Covers',
};

async function ensureSheetStructure(auth: any) {
  if (!SHEET_ID) {
    console.error('SHEET_ID missing');
    return;
  }
  const sheets = google.sheets({ version: 'v4', auth });
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const existingTitles = (meta.data.sheets || []).map((s) => s.properties?.title);
  const addRequests: any[] = [];
  for (const title of Object.keys(REQUIRED_TABS)) {
    if (!existingTitles.includes(title)) {
      addRequests.push({ addSheet: { properties: { title } } });
    }
  }
  if (addRequests.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: addRequests },
    });
  }
  for (const [title, headers] of Object.entries(REQUIRED_TABS)) {
    const range = `${title}!1:1`;
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range,
    });
    const existing = res.data.values?.[0] || [];
    const missing = headers.filter((h) => !existing.includes(h));
    if (missing.length) {
      const newHeaders = [...existing, ...missing];
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range,
        valueInputOption: 'RAW',
        requestBody: { values: [newHeaders] },
      });
    }
  }
}

async function ensureDriveFolders(auth: any) {
  const drive = google.drive({ version: 'v3', auth });
  for (const [envKey, name] of Object.entries(DRIVE_FOLDERS)) {
    const id = process.env[envKey] || '';
    if (id) {
      try {
        await drive.files.get({ fileId: id, fields: 'id' });
      } catch (err) {
        console.warn(`Invalid folder ID for ${envKey}`);
      }
    } else if (envKey !== 'RAW_FOLDER_ID') {
      const res = await drive.files.create({
        requestBody: { name, mimeType: 'application/vnd.google-apps.folder' },
        fields: 'id',
      });
      console.log(`Created folder ${name}: ${res.data.id}`);
    }
  }
}

async function logSystemOk(auth: any) {
  if (!SHEET_ID) return;
  const sheets = google.sheets({ version: 'v4', auth });
  const range = `'Needs Attention'!A:E`;
  const values = [
    ['system_ok', '', '', '', new Date().toISOString()],
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

async function main() {
  const auth = await google.auth.getClient({
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });
  await ensureSheetStructure(auth);
  await ensureDriveFolders(auth);
  await logSystemOk(auth);
  console.log('Health check complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

