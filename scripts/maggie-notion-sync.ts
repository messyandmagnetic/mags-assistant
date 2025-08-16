import fs from 'fs';
import path from 'path';
import { Client } from '@notionhq/client';

interface QueueItem {
  id: string;
  filename: string;
  emotion?: string;
  caption?: string;
  status?: string;
  scheduledDate?: string;
}

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const queueFile = path.resolve('queue.json');
const BASE_TITLE = '🎬 TikTok Auto Queue';

/** Ensure Notion database exists, creating with required schema if missing. */
export async function initNotionBoard(): Promise<string> {
  const parent = process.env.NOTION_HQ_PAGE_ID;
  if (!parent) throw new Error('Missing NOTION_HQ_PAGE_ID');

  const search = await notion.search({
    query: BASE_TITLE,
    filter: { property: 'object', value: 'database' }
  });
  const existing = search.results.find((r: any) => r.title?.[0]?.plain_text === BASE_TITLE) as any;
  if (existing) return existing.id;

  const statusOptions = ['Raw', 'Queued', 'Scheduled', 'Posted', 'Retry', 'Flop'].map(name => ({ name }));
  const emotionOptions = ['Funny', 'Emotional', 'Light', 'Promo', 'Validating'].map(name => ({ name }));

  const db = await notion.databases.create({
    parent: { type: 'page_id', page_id: parent },
    title: [{ type: 'text', text: { content: BASE_TITLE } }],
    properties: {
      'Post Title': { title: {} },
      'Filename': { rich_text: {} },
      'Status': { select: { options: statusOptions } },
      'Scheduled Date': { date: {} },
      'Emotion': { select: { options: emotionOptions } },
      'Caption': { rich_text: {} },
      'Notes': { rich_text: {} }
    }
  });
  return db.id;
}

function readQueue(): QueueItem[] {
  if (!fs.existsSync(queueFile)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
    return data.items || [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueueItem[]) {
  fs.writeFileSync(queueFile, JSON.stringify({ items }, null, 2));
}

/** Mirror local queue.json items to the Notion board. */
export async function syncQueueToNotion(databaseId: string): Promise<void> {
  const items = readQueue();
  for (const item of items) {
    const res = await notion.databases.query({
      database_id: databaseId,
      filter: { property: 'Filename', rich_text: { equals: item.id } }
    });
    const props: any = {
      'Post Title': { title: [{ text: { content: item.filename } }] },
      'Filename': { rich_text: [{ text: { content: item.id } }] },
      'Emotion': item.emotion ? { select: { name: item.emotion } } : undefined,
      'Caption': item.caption ? { rich_text: [{ text: { content: item.caption } }] } : undefined,
      'Status': item.status ? { select: { name: item.status } } : undefined,
      'Scheduled Date': item.scheduledDate ? { date: { start: item.scheduledDate } } : undefined
    };
    if (res.results.length) {
      await notion.pages.update({ page_id: res.results[0].id, properties: props });
    } else {
      await notion.pages.create({
        parent: { database_id: databaseId },
        properties: props
      });
    }
  }
}

/** Pull edits from Notion back to queue.json. */
export async function watchNotionBoardChanges(databaseId: string): Promise<void> {
  const res = await notion.databases.query({ database_id: databaseId });
  const items: QueueItem[] = res.results.map((page: any) => {
    const p = page.properties;
    return {
      id: p['Filename']?.rich_text?.[0]?.plain_text || '',
      filename: p['Post Title']?.title?.[0]?.plain_text || '',
      emotion: p['Emotion']?.select?.name,
      caption: p['Caption']?.rich_text?.[0]?.plain_text,
      status: p['Status']?.select?.name,
      scheduledDate: p['Scheduled Date']?.date?.start
    } as QueueItem;
  });
  writeQueue(items);
}

/** Update board title with Maggie's status tag. */
export async function updateNotionStatus(databaseId: string, active: boolean): Promise<void> {
  const tag = active ? '🟢 Maggie active' : '🛑 Maggie resting (overload)';
  await notion.databases.update({
    database_id: databaseId,
    title: [{ type: 'text', text: { content: `${BASE_TITLE} – ${tag}` } }]
  });
}

// Basic CLI for manual runs
if (require.main === module) {
  (async () => {
    const dbId = process.env.NOTION_QUEUE_DB || await initNotionBoard();
    const cmd = process.argv[2];
    if (cmd === 'push') await syncQueueToNotion(dbId);
    else if (cmd === 'pull') await watchNotionBoardChanges(dbId);
    else if (cmd === 'status') await updateNotionStatus(dbId, process.argv[3] !== 'rest');
  })().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

