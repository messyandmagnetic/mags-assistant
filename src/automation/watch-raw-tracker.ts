import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';
import { appendRows } from '../../lib/google.js';

export interface RawTrackerEnv {
  RAW_DROP_PATH?: string; // local path to Raw Footage Drop Folder
  SHEET_ID?: string; // TikTok Tracker sheet ID
}

/**
 * startRawTracker watches the raw footage folder, classifies new videos,
 * renames them, and logs the result to a Google Sheet.
 */
export function startRawTracker(env: RawTrackerEnv) {
  const folder = env.RAW_DROP_PATH || './Raw';
  const sheetId = env.SHEET_ID;

  const watcher = chokidar.watch(folder, { ignoreInitial: true });

  watcher.on('add', async (file) => {
    const { type, emotion } = classify(file);
    const date = new Date().toISOString().split('T')[0];
    const ext = path.extname(file);
    const newName = `${type}-${emotion}-${date}${ext}`;
    const newPath = path.join(path.dirname(file), newName);

    try {
      fs.renameSync(file, newPath);
    } catch (err) {
      console.error('Failed to rename file', err);
    }

    if (sheetId) {
      try {
        await appendRows(sheetId, 'Sheet1!A:D', [[date, newName, type, emotion]]);
      } catch (err) {
        console.error('Failed to append to sheet', err);
      }
    } else {
      console.warn('SHEET_ID not set; skipping sheet log');
    }
  });

  return watcher;
}

function classify(filePath: string): { type: string; emotion: string } {
  const base = path.basename(filePath).toLowerCase();
  let type = 'misc';
  if (base.includes('funny')) type = 'funny';
  else if (base.includes('emotional')) type = 'emotional';
  else if (base.includes('trend')) type = 'trending';

  let emotion = 'neutral';
  if (base.includes('happy')) emotion = 'happy';
  else if (base.includes('sad') || base.includes('cry')) emotion = 'sad';
  else if (base.includes('angry')) emotion = 'angry';
  else if (base.includes('excited')) emotion = 'excited';

  if (emotion === 'neutral') {
    if (type === 'funny') emotion = 'happy';
    else if (type === 'emotional') emotion = 'sad';
    else if (type === 'trending') emotion = 'excited';
  }

  return { type, emotion };
}

// Allow running as a standalone script
if (require.main === module) {
  startRawTracker({
    RAW_DROP_PATH: process.env.RAW_DROP_PATH,
    SHEET_ID: process.env.SHEET_ID,
  });
}

