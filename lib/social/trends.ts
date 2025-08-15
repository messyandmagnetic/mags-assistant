import fs from 'fs';
import path from 'path';

export interface ViralCreatorLog {
  creator: string;
  postTime: string;
  hook: string;
  audio: string;
  overlay: string;
  firstComment: string;
}

const logPath = path.resolve('public/viral-log.json');

export function recordViralExample(entry: ViralCreatorLog) {
  let data: { generated_at: string; creators: ViralCreatorLog[] } = {
    generated_at: new Date().toISOString(),
    creators: [],
  };
  try {
    data = JSON.parse(fs.readFileSync(logPath, 'utf8'));
  } catch {}
  data.creators.push(entry);
  fs.writeFileSync(logPath, JSON.stringify(data, null, 2));
}

export function summarizeToNotion(entries: ViralCreatorLog[]) {
  console.log('[trends] summary', entries.length);
}
