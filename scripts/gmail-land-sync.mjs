import fs from 'node:fs/promises';

const OUT_FILE = 'public/.inbox-land.json';
const KEYWORDS = ['grant','land','equity','Coyote','funding','HELOC','nonprofit','women'];

const token = process.env.GMAIL_ACCESS_TOKEN;
const appsScript = process.env.GMAIL_APPS_SCRIPT_URL;
const workerName = process.env.CF_WORKER_NAME;

async function fetchFromGmail() {
  const query = `label:"Land Outreach" OR subject:(${KEYWORDS.join(' OR ')})`;
  const url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=' + encodeURIComponent(query);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error('Gmail list failed ' + res.status);
  }
  const list = await res.json();
  const messages = [];
  for (const m of list.messages || []) {
    const mRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!mRes.ok) continue;
    const j = await mRes.json();
    const headers = Object.fromEntries((j.payload?.headers || []).map(h=>[h.name.toLowerCase(), h.value]));
    messages.push({
      id: j.id,
      from: headers['from'] || '',
      subject: headers['subject'] || '',
      date: headers['date'] || '',
      snippet: j.snippet || '',
      action_suggested: 'review'
    });
  }
  return messages;
}

async function fetchFromAppsScript() {
  const res = await fetch(appsScript);
  if (!res.ok) throw new Error('Apps Script fetch failed');
  return await res.json();
}

async function fetchFromWorker() {
  const res = await fetch(`https://${workerName}.workers.dev/gmail-land`);
  if (!res.ok) throw new Error('Worker fetch failed');
  return await res.json();
}

let messages = [];
try {
  if (token) {
    messages = await fetchFromGmail();
  } else if (appsScript) {
    messages = await fetchFromAppsScript();
  } else if (workerName) {
    messages = await fetchFromWorker();
  } else {
    console.log('No Gmail credentials or bridge; produced empty inbox.');
  }
} catch (err) {
  console.error('Failed to fetch Gmail', err);
}

await fs.writeFile(OUT_FILE, JSON.stringify(messages, null, 2));
console.log(`Saved ${messages.length} messages to ${OUT_FILE}`);
