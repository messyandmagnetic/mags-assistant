import { getNotion } from './client';

export async function syncStripeNotion() {
  // TODO placeholder; returns {ok:true}
  return { ok: true };
}

export async function genProductImages() {
  // TODO placeholder; returns {ok:true}
  return { ok: true };
}

export async function auditStripe() {
  // TODO placeholder; returns {ok:true, fix:true}
  return { ok: true, fix: true };
}

export async function createNotionTask(title: string, details: string) {
  const notion = getNotion();
  const db = process.env.NOTION_QUEUE_DB!;
  await notion.pages.create({
    parent: { database_id: db },
    properties: {
      Task: { title: [{ text: { content: title } }] },
      Status: { select: { name: 'Draft' } },
      Details: { rich_text: [{ text: { content: details } }] },
    },
  });
  return { ok: true };
}

export async function notify(opts: {
  level?: 'info' | 'warn' | 'error';
  title: string;
  message: string;
  links?: string[];
  approveId?: string;
}) {
  await fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
}
