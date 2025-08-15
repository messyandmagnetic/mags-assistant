import fs from 'fs';
import path from 'path';
import { summarizeToNotion } from '../../../../lib/social/trends.js';

export async function runDailyLearningCycle() {
  const logPath = path.resolve('public/viral-log.json');
  let trends = { creators: [] as any[] };
  try {
    trends = JSON.parse(fs.readFileSync(logPath, 'utf8'));
  } catch {}
  console.log('[daily] trend count', trends.creators.length);
  summarizeToNotion(trends.creators);
  return { ok: true };
}
