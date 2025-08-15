const SHEET_ID = PropertiesService.getScriptProperties().getProperty('USED_CONTENT_LOG_SHEET_ID');
const PRIVACY_TAB = 'Privacy Log';
const PRIVACY_HEADERS = [
  'timestamp',
  'face_id',
  'video_id',
  'visibility',
  'posts_today',
  'oversaturated',
  'quality',
  'sensitive_context',
  'warning',
];

function appendPrivacyLog(entries) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(PRIVACY_TAB) || ss.insertSheet(PRIVACY_TAB);
  ensurePrivacyHeaders_(sh);
  const existing = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 0), PRIVACY_HEADERS.length).getValues();
  entries.forEach((entry) => {
    const ts = entry.ts instanceof Date ? entry.ts : new Date(entry.ts);
    const day = Utilities.formatDate(ts, 'UTC', 'yyyy-MM-dd');
    const face = entry.faceId || '';
    const video = entry.videoId || '';
    const visibility = entry.visibility || '';
    const quality = entry.quality || '';
    const sensitive = entry.sensitive ? 'yes' : '';
    const postsToday = existing.filter((r) => r[1] === face && String(r[0]).startsWith(day)).length + 1;
    const oversaturated = postsToday > 4 ? 'yes' : '';
    const warnings = [];
    if (oversaturated) warnings.push('oversaturation');
    if (quality.toLowerCase() === 'low') warnings.push('low_quality');
    if (sensitive) warnings.push('sensitive_context');
    sh.appendRow([
      ts,
      face,
      video,
      visibility,
      postsToday,
      oversaturated,
      quality,
      sensitive,
      warnings.join(','),
    ]);
    if (warnings.some((w) => w !== 'oversaturation')) {
      notifyWarning_(face, video, warnings);
    }
    existing.push([ts, face, video, visibility, postsToday, oversaturated, quality, sensitive, warnings.join(',')]);
  });
}

function ensurePrivacyHeaders_(sh) {
  const existing = sh.getRange(1, 1, 1, PRIVACY_HEADERS.length).getValues()[0];
  let needsWrite = false;
  for (let i = 0; i < PRIVACY_HEADERS.length; i++) {
    if (existing[i] !== PRIVACY_HEADERS[i]) {
      needsWrite = true;
      break;
    }
  }
  if (needsWrite) {
    sh.clear();
    sh.getRange(1, 1, 1, PRIVACY_HEADERS.length).setValues([PRIVACY_HEADERS]);
  }
  sh.setFrozenRows(1);
}

function notifyWarning_(face, video, warnings) {
  const email = PropertiesService.getScriptProperties().getProperty('PRIVACY_ALERT_EMAIL');
  if (!email) return;
  const subject = `Privacy warning for ${face}`;
  const body = `Video ${video} flagged: ${warnings.join(', ')}`;
  MailApp.sendEmail(email, subject, body);
}
