import { writeFileSync } from 'node:fs';

const QUIZ_SHEET_ID = process.env.QUIZ_SHEET_ID || '1JCcWIU7Mry540o3dpYlIvR0k4pjsGF743bG8vu8cds0';
const FEEDBACK_SHEET_ID = process.env.FEEDBACK_SHEET_ID || '1DdqXoAdV-VQ565aHzJ9W0qsG5IJqpRBf7FE6-HkzZm8';
const NOTION_DB = process.env.NOTION_BRAIN_DB || '';
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const STRIPE_KEY = process.env.STRIPE_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!NOTION_TOKEN || !GOOGLE_API_KEY) {
  console.log('Missing NOTION_TOKEN or GOOGLE_API_KEY; skipping brain sync.');
  process.exit(0);
}

async function fetchSheet(id, tab) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${tab}?key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`sheet_fetch_failed_${id}_${tab}`);
  return res.json();
}

function toNotionProps(headers, row) {
  const obj = {};
  headers.forEach((h, i) => {
    const v = row[i] || '';
    if (h === 'Item') obj['Item'] = { title: [{ text: { content: v } }] };
    else obj[h] = { rich_text: [{ text: { content: v } }] };
  });
  return obj;
}

async function upsertNotion(item) {
  if (!NOTION_DB) return;
  const existing = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      filter: {
        property: 'Submission ID',
        rich_text: { equals: item.properties['Submission ID']?.rich_text?.[0]?.text?.content || '' }
      }
    })
  }).then(r => r.json()).catch(() => ({}));
  if (existing.results && existing.results.length) return { skipped: true };
  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'content-type': 'application/json'
    },
    body: JSON.stringify({ parent: { database_id: NOTION_DB }, ...item })
  });
  return { ok: res.ok };
}

async function notifyTelegram(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const u = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }) });
}

async function processSheet(id, tab, type) {
  try {
    const data = await fetchSheet(id, tab);
    const [headers, ...rows] = data.values || [];
    if (!headers) return;
    for (const row of rows) {
      const props = toNotionProps(headers, row);
      props['Type'] = { select: { name: type } };
      const res = await upsertNotion({ properties: props });
      if (res?.ok) await notifyTelegram(`[Mags] ${type} ${props['Submission ID']?.rich_text?.[0]?.text?.content || ''}`);
    }
  } catch (err) {
    console.error(`sheet_error_${id}_${tab}`, err.message);
  }
}

await processSheet(QUIZ_SHEET_ID, 'Quiz_Responses', 'quiz');
await processSheet(FEEDBACK_SHEET_ID, 'Feedback_Responses', 'feedback');

writeFileSync('public/brain-sync.json', JSON.stringify({ lastRun: new Date().toISOString() }, null, 2));
console.log('brain sync done');
