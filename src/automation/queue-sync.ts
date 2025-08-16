import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import { getEnv } from '../env.local';

export function syncQueueToFinalFolder() {
  const queuePath = path.join('/mnt/data', 'raw');
  const finalId = getEnv('DRIVE_FINAL_FOLDER_ID');
  const files = fs.readdirSync(queuePath).filter(f => f.endsWith('.done'));
  for (const file of files) {
    const src = path.join(queuePath, file);
    const dest = path.join('/mnt/data/final', file.replace(/\.done$/, ''));
    try {
      fs.renameSync(src, dest);
      console.log(`Moved ${file} to final folder ${finalId}`);
    } catch (err) {
      console.error('Failed to move file', err);
    }
  }
}

cron.schedule('*/15 * * * *', syncQueueToFinalFolder);
