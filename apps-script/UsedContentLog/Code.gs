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
  'result',
  'notes',
];

function appendPrivacyLog(entries) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(PRIVACY_TAB) || ss.insertSheet(PRIVACY_TAB);
  ensurePrivacyHeaders_(sh);
  ensureConditionalFormatting_(sh);
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
    const result = entry.result || '';
    const note = result === 'Success' ? '⭐' : '';
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
      result,
      note,
    ]);
    if (warnings.some((w) => w !== 'oversaturation')) {
      notifyWarning_(face, video, warnings);
    }
    existing.push([ts, face, video, visibility, postsToday, oversaturated, quality, sensitive, warnings.join(','), result, note]);
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

function ensureConditionalFormatting_(sh) {
  const resultCol = PRIVACY_HEADERS.indexOf('result') + 1;
  const notesCol = PRIVACY_HEADERS.indexOf('notes') + 1;
  if (resultCol < 1 || notesCol < 1) return;
  const lastRow = sh.getMaxRows();
  const lastCol = PRIVACY_HEADERS.length;
  const dataRange = sh.getRange(2, 1, lastRow - 1, lastCol);
  const colLetter = columnToLetter_(resultCol);
  const flopRule = SpreadsheetApp.newConditionalFormatRule()
    .setRanges([dataRange])
    .whenFormulaSatisfied(`=$${colLetter}2="Flop"`)
    .setBackground('#f4cccc')
    .build();
  const successRule = SpreadsheetApp.newConditionalFormatRule()
    .setRanges([sh.getRange(2, notesCol, lastRow - 1, 1)])
    .whenFormulaSatisfied(`=$${colLetter}2="Success"`)
    .setBackground('#fff2cc')
    .build();
  sh.setConditionalFormatRules([flopRule, successRule]);
}

function columnToLetter_(column) {
  let temp = '';
  while (column > 0) {
    const rem = (column - 1) % 26;
    temp = String.fromCharCode(65 + rem) + temp;
    column = Math.floor((column - rem - 1) / 26);
  }
  return temp;
}

function notifyWarning_(face, video, warnings) {
  const email = PropertiesService.getScriptProperties().getProperty('PRIVACY_ALERT_EMAIL');
  if (!email) return;
  const subject = `Privacy warning for ${face}`;
  const body = `Video ${video} flagged: ${warnings.join(', ')}`;
  MailApp.sendEmail(email, subject, body);
}
