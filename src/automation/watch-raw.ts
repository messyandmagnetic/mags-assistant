import chokidar from 'chokidar';
import { spawn } from 'child_process';
import path from 'path';

export interface WatcherEnv {
  RAW_DROP_PATH?: string; // path to local sync of Google Drive "Raw Footage Drop Folder"
  DRIVE_FINAL_FOLDER_ID?: string; // Google Drive "Finals" folder ID
  SHEET_ID?: string; // Google Sheet ID for logging
}

/**
 * startRawWatcher monitors the raw footage folder for new videos and triggers the
 * Python video pipeline. Classification is a simple placeholder that should be
 * replaced with real emotion/trend detection.
 */
export function startRawWatcher(env: WatcherEnv) {
  const folder = env.RAW_DROP_PATH || './Raw';
  const watcher = chokidar.watch(folder, { ignoreInitial: true });

  watcher.on('add', (file) => {
    const label = classify(file);
    // Spawn Python video pipeline: overlays, captions, etc.
    // NOTE: ensure Python dependencies (opencv, etc.) are installed.
    spawn('python', ['scripts/maggie_video_pipeline.py', file, label], {
      stdio: 'inherit',
    });
  });

  return watcher;
}

function classify(filePath: string): string {
  const base = path.basename(filePath).toLowerCase();
  if (base.includes('funny')) return 'funny';
  if (base.includes('soul')) return 'soulful';
  if (base.includes('chaos')) return 'chaotic';
  if (base.includes('trend')) return 'trend';
  return 'misc';
}
