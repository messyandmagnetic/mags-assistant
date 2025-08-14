const QUIZ_FORM_ID = '3qlZQ9';
const FEEDBACK_FORM_ID = 'nGPKDo';
const QUIZ_SHEET_ID = '1JCcWIU7Mry540o3dpYlIvR0k4pjsGF743bG8vu8cds0';
const FEEDBACK_SHEET_ID = '1DdqXoAdV-VQ565aHzJ9W0qsG5IJqpRBf7FE6-HkzZm8';
const QUIZ_TAB = 'Quiz_Responses';
const FEEDBACK_TAB = 'Feedback_Responses';
const LOG_TAB = 'Logs';
const CANONICAL_HEADERS = [
  'timestamp',
  'form_id',
  'submission_id',
  'email',
  'full_name',
  'phone',
  'product_choice',
  'score',
  'result_tier',
  'rating',
  'feedback_text',
  'source',
  'user_agent',
  'ip',
  'raw_json',
];

function doPost(e) {
  const ts = new Date().toISOString();
  const action = e.parameter?.action || '';
  if (action === 'backfill') {
    const apiKey = e.parameter.api_key || e.headers['x-tally-key'] || PropertiesService.getScriptProperties().getProperty('TALLY_API_KEY');
    const form = e.parameter.form_id || '';
    const result = backfillTally(form, apiKey);
    return json({ ok: true, status: result });
  }

  const secret = PropertiesService.getScriptProperties().getProperty('TALLY_WEBHOOK_SECRET');
  const signature = (e.headers && (e.headers['x-tally-signature'] || e.headers['X-Tally-Signature'])) || '';
  if (secret) {
    const raw = e.postData.contents;
    const check = Utilities.computeHmacSha256Signature(raw, secret)
      .map((b) => ('0' + (b & 0xff).toString(16)).slice(-2))
      .join('');
    if (check !== signature) {
      logEntry(ts, '', '', '', '', 'error', 'signature_mismatch');
      return json({ ok: false, error: 'invalid_signature' }, 401);
    }
  }

  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    logEntry(ts, '', '', '', '', 'error', 'parse_error');
    return json({ ok: false, error: 'invalid_json' }, 400);
  }
  const formId = payload.form_id || payload.formId || payload.data?.formId || '';
  const target = formId === FEEDBACK_FORM_ID ? { id: FEEDBACK_SHEET_ID, tab: FEEDBACK_TAB } : { id: QUIZ_SHEET_ID, tab: QUIZ_TAB };
  const norm = normalizeSubmission(payload, ts, formId);
  try {
    const result = appendRow(target.id, target.tab, norm);
    const status = result.status === 'duplicate' ? 'duplicate-ignored' : result.status;
    logEntry(ts, formId, norm.submission_id, target.id, target.tab, status, result.error);
    if (status === 'ok') postAppendHook(norm);
    return json({ ok: true, status });
  } catch (err) {
    logEntry(ts, formId, norm.submission_id, target.id, target.tab, 'error', String(err));
    return json({ ok: false, error: 'append_failed' }, 500);
  }
}

function doGet(e) {
  if (e && e.pathInfo === 'health') {
    return json({ ok: true, tabs: [QUIZ_TAB, FEEDBACK_TAB] });
  }
  return json({ ok: true });
}

function appendRow(sheetId, tab, row) {
  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName(tab) || ss.insertSheet(tab);
  ensureHeaders(sh);
  const subCol = CANONICAL_HEADERS.indexOf('submission_id') + 1;
  if (subCol > 0) {
    const existing = sh
      .getRange(2, subCol, Math.max(sh.getLastRow() - 1, 0), 1)
      .getValues()
      .flat();
    if (existing.indexOf(row.submission_id) !== -1) {
      return { status: 'duplicate' };
    }
  }
  const values = CANONICAL_HEADERS.map((h) => row[h] || '');
  sh.appendRow(values);
  return { status: 'ok' };
}

function ensureHeaders(sh) {
  const existing = sh.getRange(1, 1, 1, CANONICAL_HEADERS.length).getValues()[0];
  let needsWrite = false;
  for (let i = 0; i < CANONICAL_HEADERS.length; i++) {
    if (existing[i] !== CANONICAL_HEADERS[i]) {
      needsWrite = true;
      break;
    }
  }
  if (needsWrite) {
    sh.clear();
    sh.getRange(1, 1, 1, CANONICAL_HEADERS.length).setValues([CANONICAL_HEADERS]);
  }
  sh.setFrozenRows(1);
  try {
    const protection = sh.getRange(1, 1, 1, CANONICAL_HEADERS.length).protect();
    protection.setDescription('Headers');
  } catch (err) {}
  const schemaCell = sh.getRange('A2');
  if (!schemaCell.getValue()) schemaCell.setValue('v1');
  protectFormulaCols(sh);
}

function logEntry(ts, formId, submissionId, sheetId, tab, status, error) {
  const ss = SpreadsheetApp.openById(sheetId);
  const log = ss.getSheetByName(LOG_TAB) || ss.insertSheet(LOG_TAB);
  log.appendRow([ts, formId, submissionId, sheetId, tab, status, error || '']);
}

function normalizeSubmission(payload, ts, formId) {
  const res = {
    timestamp: ts,
    form_id: formId,
    submission_id: payload.responseId || payload.data?.id || payload.id || '',
    email: '',
    full_name: '',
    phone: '',
    product_choice: '',
    score: '',
    result_tier: '',
    rating: '',
    feedback_text: '',
    source: payload.source || '',
    user_agent: payload.user_agent || payload.userAgent || '',
    ip: payload.ip || '',
    raw_json: JSON.stringify(payload),
  };
  const fields = payload.data?.fields || payload.data?.data || payload.fields || [];
  const map = {};
  if (Array.isArray(fields)) {
    fields.forEach((f) => {
      const key = (f.key || f.id || f.label || '').toString().toLowerCase();
      const v = f.value || f.answer || '';
      map[key] = typeof v === 'string' ? v : JSON.stringify(v);
    });
  } else if (fields && typeof fields === 'object') {
    Object.keys(fields).forEach((k) => (map[k.toLowerCase()] = fields[k]));
  }
  res.email = map.email || '';
  res.full_name = map.full_name || map.name || '';
  res.phone = map.phone || '';
  res.product_choice = map.product_choice || map.product || '';
  res.score = map.score || '';
  res.result_tier = map.result_tier || '';
  res.rating = map.rating || '';
  res.feedback_text = map.feedback_text || map.feedback || '';
  res.donate_now = map.donate_now || map.donate || '';
  return res;
}

function postAppendHook(sub) {
  const props = PropertiesService.getScriptProperties();
  const notionToken = props.getProperty('NOTION_TOKEN');
  const notionDb = props.getProperty('NOTION_DB_TRENDS');
  if (
    notionToken &&
    notionDb &&
    sub.form_id === QUIZ_FORM_ID &&
    sub.email &&
    (sub.product_choice || sub.score || sub.result_tier)
  ) {
    const sent = props.getProperty('NOTION_IDS') || '';
    const ids = sent ? sent.split(',') : [];
    if (ids.indexOf(sub.submission_id) === -1) {
      const payload = {
        parent: { database_id: notionDb },
        properties: {
          Title: { title: [{ text: { content: sub.full_name || sub.email } }] },
          Email: { email: sub.email },
          Submission: { rich_text: [{ text: { content: sub.submission_id } }] },
          Product: { rich_text: [{ text: { content: sub.product_choice || '' } }] },
          Score: sub.score ? { number: Number(sub.score) } : undefined,
          Tier: { rich_text: [{ text: { content: sub.result_tier || '' } }] },
        },
      };
      try {
        UrlFetchApp.fetch('https://api.notion.com/v1/pages', {
          method: 'post',
          headers: {
            Authorization: `Bearer ${notionToken}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28',
          },
          payload: JSON.stringify(payload),
        });
        ids.push(sub.submission_id);
        props.setProperty('NOTION_IDS', ids.join(','));
      } catch (err) {
        logEntry(new Date().toISOString(), sub.form_id, sub.submission_id, '', '', 'error', 'notion_' + err);
      }
    }
  }
  if (String(sub.donate_now).toLowerCase() === 'true' || sub.product_choice === 'Donate now') {
    logEntry(new Date().toISOString(), sub.form_id, sub.submission_id, '', '', 'stripe-refresh-needed', '');
  }
}

function protectFormulaCols(sh) {
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return;
  const lastCol = sh.getLastColumn();
  for (let c = 1; c <= lastCol; c++) {
    const cell = sh.getRange(2, c);
    if (cell.getFormula()) {
      try {
        sh.getRange(2, c, lastRow - 1).protect().setDescription('Formula');
      } catch (err) {}
    }
  }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Tally')
    .addItem('Backfill Tally', 'backfillMenu')
    .addItem('Fix headers', 'fixHeaders')
    .addItem('Dedupe now', 'dedupeAll')
    .addToUi();
}

function backfillMenu() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('TALLY_API_KEY');
  if (!apiKey) return;
  backfillTally(QUIZ_FORM_ID, apiKey);
  backfillTally(FEEDBACK_FORM_ID, apiKey);
}

function backfillTally(formId, apiKey) {
  if (!apiKey) return 'no_api_key';
  const map = {};
  map[QUIZ_FORM_ID] = { sheet: QUIZ_SHEET_ID, tab: QUIZ_TAB };
  map[FEEDBACK_FORM_ID] = { sheet: FEEDBACK_SHEET_ID, tab: FEEDBACK_TAB };
  const f = map[formId];
  if (!f) return 'unknown_form';
  const submissions = fetchAll(apiKey, formId);
  submissions.forEach((p) => {
    const norm = normalizeSubmission(p, p.createdAt || new Date().toISOString(), formId);
    const r = appendRow(f.sheet, f.tab, norm);
    logEntry(new Date().toISOString(), formId, norm.submission_id, f.sheet, f.tab, 'backfill_' + r.status, '');
  });
  return 'done';
}

function fixHeaders() {
  const s1 = SpreadsheetApp.openById(QUIZ_SHEET_ID).getSheetByName(QUIZ_TAB) || SpreadsheetApp.openById(QUIZ_SHEET_ID).insertSheet(QUIZ_TAB);
  ensureHeaders(s1);
  const s2 = SpreadsheetApp.openById(FEEDBACK_SHEET_ID).getSheetByName(FEEDBACK_TAB) || SpreadsheetApp.openById(FEEDBACK_SHEET_ID).insertSheet(FEEDBACK_TAB);
  ensureHeaders(s2);
}

function dedupeAll() {
  dedupeById(QUIZ_SHEET_ID, QUIZ_TAB);
  dedupeById(FEEDBACK_SHEET_ID, FEEDBACK_TAB);
}

function dedupeById(sheetId, tab) {
  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName(tab);
  if (!sh) return;
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return;
  const headers = data[0];
  const subIdx = headers.indexOf('submission_id');
  const seen = {};
  const rows = [headers];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const id = row[subIdx];
    if (!seen[id]) {
      seen[id] = true;
      rows.push(row);
    }
  }
  sh.clearContents();
  sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
}

function fetchAll(apiKey, formId) {
  const res = [];
  let page = 1;
  while (true) {
    const url = `https://api.tally.so/forms/${formId}/responses?page=${page}&limit=100`;
    const r = UrlFetchApp.fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    const data = JSON.parse(r.getContentText());
    const items = data.data || data.responses || [];
    res.push(...items);
    if (!data.next_page) break;
    page++;
  }
  return res;
}

function testInsert() {
  const ts = new Date().toISOString();
  const base = {
    timestamp: ts,
    form_id: QUIZ_FORM_ID,
    submission_id: 'test-' + ts,
    email: 'test@example.com',
    full_name: 'Test User',
    phone: '',
    product_choice: 'sample',
    score: '10',
    result_tier: 'A',
    rating: '5',
    feedback_text: 'hello',
    source: 'test',
    user_agent: 'script',
    ip: '127.0.0.1',
    raw_json: '{}',
  };
  appendRow(QUIZ_SHEET_ID, QUIZ_TAB, base);
  base.form_id = FEEDBACK_FORM_ID;
  base.submission_id = 'test-feedback-' + ts;
  appendRow(FEEDBACK_SHEET_ID, FEEDBACK_TAB, base);
}

function json(obj, status) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
    .setStatusCode(status || 200);
}
