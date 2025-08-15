import fs from 'fs';
import path from 'path';

const logPath = path.resolve('public/viral-log.json');

export function recordViralExample(entry) {
  let data = { generated_at: new Date().toISOString(), creators: [] };
  try {
    data = JSON.parse(fs.readFileSync(logPath, 'utf8'));
  } catch {}
  data.creators.push(entry);
  fs.writeFileSync(logPath, JSON.stringify(data, null, 2));
}

export function summarizeToNotion(entries) {
  console.log('[trends] summary', entries.length);
}
