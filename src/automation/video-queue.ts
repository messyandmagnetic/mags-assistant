import Database from 'better-sqlite3';

export interface QueuedVideo {
  id?: number;
  fileId: string; // Google Drive file ID
  caption: string;
  emotion?: string;
  status?: 'pending' | 'posted' | 'failed';
  attempts?: number;
  scheduledAt?: string; // ISO date
}

export class VideoQueue {
  private db: Database.Database;
  constructor(dbPath = 'data/automation.db') {
    this.db = new Database(dbPath);
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS video_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fileId TEXT NOT NULL,
          caption TEXT NOT NULL,
          emotion TEXT,
          status TEXT DEFAULT 'pending',
          attempts INTEGER DEFAULT 0,
          scheduledAt TEXT
        )`
      )
      .run();
  }

  enqueue(video: QueuedVideo) {
    const stmt = this.db.prepare(
      `INSERT INTO video_queue (fileId, caption, emotion, status, attempts, scheduledAt)
       VALUES (@fileId, @caption, @emotion, @status, @attempts, @scheduledAt)`
    );
    stmt.run({ ...video, status: video.status ?? 'pending', attempts: video.attempts ?? 0 });
  }

  nextPending(): QueuedVideo | undefined {
    const row = this.db.prepare(`SELECT * FROM video_queue WHERE status='pending' ORDER BY id LIMIT 1`).get();
    return row as QueuedVideo | undefined;
  }

  markPosted(id: number) {
    this.db.prepare(`UPDATE video_queue SET status='posted' WHERE id=?`).run(id);
  }

  markFailed(id: number) {
    this.db.prepare(
      `UPDATE video_queue SET status='failed', attempts = attempts + 1 WHERE id=?`
    ).run(id);
  }

  pendingCount(): number {
    const row = this.db.prepare(`SELECT COUNT(*) as cnt FROM video_queue WHERE status='pending'`).get();
    return row?.cnt ?? 0;
  }
}
