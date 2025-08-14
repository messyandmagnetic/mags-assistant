import { readFileSync, writeFileSync } from 'node:fs';

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const GAS_READ_URL = process.env.GAS_READ_URL;

async function sendTelegram(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('telegram_not_configured');
    return { sent: false };
  }
  const u = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const r = await fetch(u, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
  });
  return { sent: r.ok };
}

async function summarizeIntake() {
  try {
    const cfg = JSON.parse(readFileSync('public/mags-config.json', 'utf8'));
    const forms = cfg?.intake?.tally?.forms || [];
    if (!GAS_READ_URL || !forms.length) {
      console.log('missing GAS_READ_URL or forms; skipping summaries');
      return true;
    }
    const blocks = [];
    for (const f of forms) {
      const url = `${GAS_READ_URL}?sheetId=${encodeURIComponent(f.sheet_id)}&tab=${encodeURIComponent(f.tab)}&limit=100`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`read_failed_${f.form_id}`);
      const rows = await res.json();
      const list = Array.isArray(rows) ? rows : rows.rows || [];
      if (f.tab.toLowerCase().includes('quiz')) {
        const tiers = {}; const prod = {};
        let scoreSum = 0, scoreCount = 0;
        for (const r of list) {
          const t = r.result_tier || 'unknown';
          tiers[t] = (tiers[t] || 0) + 1;
          const s = parseFloat(r.score);
          if (!isNaN(s)) { scoreSum += s; scoreCount++; }
          const p = r.product_choice || 'none';
          prod[p] = (prod[p] || 0) + 1;
        }
        const avg = scoreCount ? (scoreSum / scoreCount).toFixed(1) : 'n/a';
        const topProduct = Object.entries(prod).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'n/a';
        blocks.push(`### Quiz (${list.length})\n- avg score: ${avg}\n- top product: ${topProduct}\n- tiers: ${Object.entries(tiers).map(([k,v])=>`${k}:${v}`).join(', ')}`);
      } else if (f.tab.toLowerCase().includes('feedback')) {
        let ratingSum = 0, ratingCount = 0; const snippets = [];
        for (const r of list) {
          const rt = parseFloat(r.rating);
          if (!isNaN(rt)) { ratingSum += rt; ratingCount++; }
          if (r.feedback_text) snippets.push(r.feedback_text.trim());
        }
        const avgRating = ratingCount ? (ratingSum / ratingCount).toFixed(1) : 'n/a';
        const snip = snippets.slice(0,5).map(s=>`> ${s}`).join('\n');
        blocks.push(`### Feedback (${list.length})\n- avg rating: ${avgRating}\n${snip}`);
      }
    }
    const md = blocks.join('\n\n');
    if (md) {
      console.log(md);
      await sendTelegram(md);
    }
    return true;
  } catch (err) {
    console.error('intake_summary_error', err.message);
    return false;
  }
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
  if (!NOTION_DB) return { skipped: true };
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

async function notifyRow(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const u = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }) });
}

async function processSheet(id, tab, type) {
  try {
    const data = await fetchSheet(id, tab);
    const [headers, ...rows] = data.values || [];
    if (!headers) return true;
    for (const row of rows) {
      const props = toNotionProps(headers, row);
      props['Type'] = { select: { name: type } };
      const res = await upsertNotion({ properties: props });
      if (res?.ok) await notifyRow(`[Mags] ${type} ${props['Submission ID']?.rich_text?.[0]?.text?.content || ''}`);
    }
    return true;
  } catch (err) {
    console.error(`sheet_error_${id}_${tab}`, err.message);
    return false;
  }
}

const QUIZ_SHEET_ID = process.env.QUIZ_SHEET_ID || '1JCcWIU7Mry540o3dpYlIvR0k4pjsGF743bG8vu8cds0';
const FEEDBACK_SHEET_ID = process.env.FEEDBACK_SHEET_ID || '1DdqXoAdV-VQ565aHzJ9W0qsG5IJqpRBf7FE6-HkzZm8';
const NOTION_DB = process.env.NOTION_BRAIN_DB || '';

async function notionSync() {
  if (!NOTION_TOKEN || !GOOGLE_API_KEY) {
    console.log('Missing NOTION_TOKEN or GOOGLE_API_KEY; skipping notion sync.');
    return true;
  }
  const a = await processSheet(QUIZ_SHEET_ID, 'Quiz_Responses', 'quiz');
  const b = await processSheet(FEEDBACK_SHEET_ID, 'Feedback_Responses', 'feedback');
  return a && b;
}

(async () => {
  const sOk = await summarizeIntake();
  const nOk = await notionSync();
  writeFileSync('public/brain-sync.json', JSON.stringify({ lastRun: new Date().toISOString(), sOk, nOk }, null, 2));
  if (!sOk || !nOk) process.exit(1);
  console.log('brain sync done');
})();

