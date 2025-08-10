import { Client } from '@notionhq/client';
import { randomUUID } from 'crypto';

export const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB = process.env.NOTION_QUEUE_DB_ID;

export function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const rt = (s) => ({ rich_text: [{ text: { content: s } }] });
const getText = (prop) => prop?.rich_text?.[0]?.plain_text || '';

export async function enqueueTask({ jobId, payload }) {
  const props = {
    Title: { title: [{ type: 'text', text: { content: `Task ${jobId}` } }] },
    JobId: rt(jobId),
    Payload: {
      rich_text: [
        {
          type: 'text',
          text: { content: JSON.stringify(payload).slice(0, 1900) },
        },
      ],
    },
    Status: { select: { name: 'Queued' } },
  };
  const page = await notion.pages.create({
    parent: { database_id: DB },
    properties: props,
  });
  return page;
}

export async function claimNextTask() {
  const res = await notion.databases.query({
    database_id: DB,
    filter: {
      and: [
        { property: 'Status', select: { equals: 'Queued' } },
        { property: 'Locked', checkbox: { equals: false } },
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
  const props = page.properties;
  const attempts = props.Attempts?.number ?? 0;
  const existing = getText(props.JobId);
  const jobId = existing || randomUUID();
  await notion.pages.update({
    page_id: page.id,
    properties: {
      Status: { select: { name: 'Running' } },
      Locked: { checkbox: true },
      Attempts: { number: attempts + 1 },
      ...(existing ? {} : { JobId: rt(jobId) }),
    },
  });
  return page;
}

export function readTask(page) {
  const props = page.properties || {};
  const jobId = getText(props.JobId) || page.id;
  let payload = {};
  try {
    const raw = getText(props.Payload);
    payload = raw ? JSON.parse(raw) : {};
  } catch {}
  return { id: jobId, payload };
}

async function findByJobId(jobId) {
  const res = await notion.databases.query({
    database_id: DB,
    filter: { property: 'JobId', rich_text: { equals: jobId } },
    page_size: 1,
  });
  return res.results[0];
}

export async function completeTask(jobId) {
  const page = await findByJobId(jobId);
  if (!page) return;
  await notion.pages.update({
    page_id: page.id,
    properties: {
      Status: { select: { name: 'Done' } },
      Locked: { checkbox: false },
    },
  });
}

export async function failTask(jobId, error) {
  const page = await findByJobId(jobId);
  if (!page) return;
  const errStr = String(error).slice(0, 1900);
  await notion.pages.update({
    page_id: page.id,
    properties: {
      Status: { select: { name: 'Failed' } },
      Locked: { checkbox: false },
      Error: rt(errStr),
    },
  });
}

export async function queueHealth() {
  requireEnv('NOTION_TOKEN');
  requireEnv('NOTION_QUEUE_DB_ID');
  await notion.databases.retrieve({ database_id: DB });
  return true;
}
