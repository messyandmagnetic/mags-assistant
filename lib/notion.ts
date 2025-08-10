import { Client } from '@notionhq/client';

export const notion = new Client({ auth: process.env.NOTION_TOKEN! });
const DB = process.env.NOTION_QUEUE_DB_ID!;

export function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

type NotionPage = any;

export async function enqueueTask(input: {
  task: string;
  payload?: any;
  runAt?: string | Date;
  callback?: string;
  jobId?: string;
}) {
  const props: any = {
    Task: { title: [{ text: { content: input.task } }] },
    Status: { select: { name: 'Queued' } },
  };
  if (input.payload)
    props['Payload'] = {
      rich_text: [
        { text: { content: JSON.stringify(input.payload).slice(0, 2000) } },
      ],
    };
  if (input.runAt)
    props['Run At'] = {
      date: { start: new Date(input.runAt).toISOString() },
    };
  if (input.callback) props['Callback'] = { url: input.callback };
  if (input.jobId)
    props['JobId'] = {
      rich_text: [{ text: { content: String(input.jobId).slice(0, 200) } }],
    };

  const page = await notion.pages.create({
    parent: { database_id: DB },
    properties: props,
  });
  return page;
}

export async function claimNextTask(): Promise<NotionPage | null> {
  const res = await notion.databases.query({
    database_id: DB,
    filter: {
      and: [
        { property: 'Status', select: { equals: 'Queued' } },
        {
          or: [
            { property: 'Run At', date: { is_empty: true } },
            {
              property: 'Run At',
              date: { on_or_before: new Date().toISOString() },
            },
          ],
        },
      ],
    },
    sorts: [{ property: 'Run At', direction: 'ascending' }],
    page_size: 1,
  });
  if (!res.results.length) return null;

  const page = res.results[0];
  const attempts = page.properties?.Attempts?.number || 0;
  await notion.pages.update({
    page_id: page.id,
    properties: {
      Status: { select: { name: 'Running' } },
      Locked: { checkbox: true },
      Attempts: { number: attempts + 1 },
    },
  });
  return page;
}

export async function completeTask(pageId: string) {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      Status: { select: { name: 'Done' } },
      Locked: { checkbox: false },
    },
  });
}

export async function failTask(pageId: string, message: string) {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      Status: { select: { name: 'Failed' } },
      Locked: { checkbox: false },
      Error: {
        rich_text: [
          { text: { content: message.slice(0, 1900) } },
        ],
      },
    },
  });
}

export function readTask(page: any) {
  const props: any = page.properties;
  const val = (key: string) => props[key];
  const text = (key: string) => (val(key)?.rich_text?.[0]?.plain_text ?? '').trim();
  const title = (val('Task')?.title?.[0]?.plain_text ?? '').trim();

  let payload: any = undefined;
  try {
    payload = text('Payload') ? JSON.parse(text('Payload')) : undefined;
  } catch {}

  return {
    id: page.id,
    task: title,
    payload,
    callback: val('Callback')?.url || undefined,
    jobId: text('JobId') || undefined,
    attempts: val('Attempts')?.number || 0,
    locked: val('Locked')?.checkbox || false,
    error: text('Error') || undefined,
  };
}
