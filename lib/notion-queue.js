import { notion, requireEnv } from './notion.js';

const dbId = () => requireEnv('NOTION_DB_TASKS_ID');

export async function createTask({ text, when, runner = 'browserless' }) {
  const props = {
    Title: { title: [{ text: { content: text } }] },
    Command: { rich_text: [{ text: { content: text } }] },
    Status: { status: { name: 'Todo' } },
    Runner: { rich_text: [{ text: { content: runner } }] }
  };
  if (when) props['When'] = { date: { start: when } };
  const page = await notion.pages.create({
    parent: { database_id: dbId() },
    properties: props,
  });
  return { id: page.id };
}

export async function getDueTask() {
  const now = new Date().toISOString();
  const r = await notion.databases.query({
    database_id: dbId(),
    filter: {
      and: [
        { property: 'Status', status: { equals: 'Todo' } },
        {
          or: [
            { property: 'When', date: { is_empty: true } },
            { property: 'When', date: { on_or_before: now } },
          ],
        },
      ],
    },
    sorts: [{ property: 'When', direction: 'ascending' }],
    page_size: 1,
  });
  const page = r.results[0];
  if (!page) return null;
  const command = page.properties?.Command?.rich_text?.[0]?.plain_text || '';
  const runner = page.properties?.Runner?.rich_text?.[0]?.plain_text || 'browserless';
  return { id: page.id, command, runner };
}

export async function markTaskStatus(id, status, result = '', viewerURL = '') {
  const props = { Status: { status: { name: status } } };
  if (result) props['Result'] = { rich_text: [{ text: { content: result } }] };
  if (viewerURL) props['ViewerURL'] = { url: viewerURL };
  await notion.pages.update({ page_id: id, properties: props });
}
