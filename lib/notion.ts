import { Client } from '@notionhq/client';

export const notion = new Client({ auth: process.env.NOTION_TOKEN! });
const DB = process.env.NOTION_QUEUE_DB!;

export function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

type NotionPage = any;

export async function enqueueTask(input: {
  task: string;
  type?: string;
  data?: any;
  runAt?: string | Date;
  priority?: 'Low' | 'Normal' | 'High';
}) {
  const props: any = {
    Task: { title: [{ text: { content: input.task } }] },
    Status: { select: { name: 'Queued' } },
  };
  if (input.type) props['Type'] = { select: { name: input.type } };
  if (input.data)
    props['Data'] = {
      rich_text: [
        { text: { content: JSON.stringify(input.data).slice(0, 2000) } },
      ],
    };
  if (input.runAt)
    props['Run At'] = {
      date: { start: new Date(input.runAt).toISOString() },
    };
  if (input.priority) props['Priority'] = { select: { name: input.priority } };

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
    sorts: [
      { property: 'Priority', direction: 'descending' },
      { property: 'Run At', direction: 'ascending' },
    ],
    page_size: 1,
  });
  if (!res.results.length) return null;

  const page = res.results[0];
  await notion.pages.update({
    page_id: page.id,
    properties: {
      Status: { select: { name: 'Running' } },
      'Ran At': { date: { start: new Date().toISOString() } },
    },
  });
  return page;
}

export async function completeTask(pageId: string) {
  await notion.pages.update({
    page_id: pageId,
    properties: { Status: { select: { name: 'Done' } } },
  });
}

export async function failTask(pageId: string, message: string) {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      Status: { select: { name: 'Failed' } },
      'Last Error': {
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
  const select = (key: string) => val(key)?.select?.name ?? null;
  const title = (val('Task')?.title?.[0]?.plain_text ?? '').trim();

  let data: any = undefined;
  try {
    data = text('Data') ? JSON.parse(text('Data')) : undefined;
  } catch {}

  return {
    id: page.id,
    task: title,
    type: select('Type') ?? 'ops',
    data,
  };
}
