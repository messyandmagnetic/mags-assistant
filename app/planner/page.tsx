import { getNotion } from '../../lib/client';
import {
  syncStripeNotion,
  genProductImages,
  auditStripe,
  createNotionTask,
  notify,
} from '../../lib/tools';

function readProp(page: any, name: string) {
  const prop = page.properties[name];
  if (!prop) return '';
  if (prop.type === 'title') return prop.title[0]?.plain_text || '';
  if (prop.type === 'rich_text') return prop.rich_text[0]?.plain_text || '';
  if (prop.type === 'select') return prop.select?.name || '';
  if (prop.type === 'date') return prop.date?.start || '';
  return '';
}

export default async function PlannerPage() {
  const notion = getNotion();
  await ensureMemory();
  const db = process.env.NOTION_QUEUE_DB!;
  const res = await notion.databases.query({ database_id: db });
  const cols: Record<string, any[]> = { Queue: [], Running: [], Done: [] };
  for (const p of res.results) {
    const status = readProp(p, 'Status') || 'Queue';
    if (!cols[status]) cols[status] = [];
    cols[status].push(p);
  }

  const order = ['Queue', 'Running', 'Done'];

  return (
    <div className="p-4">
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {quick.map((q) => (
          <form key={q.label} action={runQuick.bind(null, q.prompt)}>
            <button className="px-3 py-1 border rounded" type="submit">
              {q.label}
            </button>
          </form>
        ))}
        <form action={plannerAction.bind(null, 'grants')}>
          <button className="px-3 py-1 border rounded" type="submit">
            Find new grants today
          </button>
        </form>
        <form action={plannerAction.bind(null, 'reconcile')}>
          <button className="px-3 py-1 border rounded" type="submit">
            Reconcile Stripe/Notion now
          </button>
        </form>
        <form action={plannerAction.bind(null, 'donor')}>
          <button className="px-3 py-1 border rounded" type="submit">
            Draft donor outreach pack
          </button>
        </form>
      </div>
      <div className="flex gap-4 overflow-x-auto">
        {order.map((key) => (
          <div key={key} className="min-w-[250px] flex-1">
            <h2 className="mb-2 font-serif text-lg">{key}</h2>
            <div className="space-y-2">
              {cols[key]?.map((p) => {
                const title = readProp(p, 'Task');
                const last =
                  readProp(p, 'Last Log') || readProp(p, 'Last Error');
                const updated =
                  readProp(p, 'Last Updated') || readProp(p, 'Date Updated') || '';
                return (
                  <a
                    key={p.id}
                    href={p.url}
                    target="_blank"
                    className="block bg-white rounded shadow p-2 border"
                  >
                    <div className="font-medium">{title}</div>
                    {last && <div className="text-sm text-gray-600">{last}</div>}
                    {updated && (
                      <div className="text-xs text-gray-400">{updated}</div>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const quick = [
  {
    label: 'Sync Stripe ↔ Notion',
    prompt:
      'Sync Stripe and Notion product catalog, reconcile by name/sku, update Notion rows with Stripe price IDs and product images where missing.',
  },
  {
    label: 'Generate on-brand images',
    prompt:
      'Generate product/cover images in Messy & Magnetic aesthetic using DALL·E prompts, upload to Stripe + Notion.',
  },
  {
    label: 'Audit Stripe products',
    prompt:
      'Audit Stripe product/price metadata, tax codes, shippable, statement descriptors, and advanced settings; produce fixes and apply.',
  },
  {
    label: 'Create Notion task for me',
    prompt:
      'Create a Notion task with status Draft and details from this conversation.',
  },
];

async function runQuick(prompt: string) {
  'use server';
  if (prompt.startsWith('Sync Stripe')) await syncStripeNotion();
  else if (prompt.startsWith('Generate')) await genProductImages();
  else if (prompt.startsWith('Audit')) await auditStripe();
  else if (prompt.startsWith('Create'))
    await createNotionTask('Planner action', prompt);
}

async function plannerAction(action: string) {
  'use server';
  if (action === 'grants')
    await notify({ level: 'info', title: 'Find grants', message: 'TODO' });
  else if (action === 'reconcile') await syncStripeNotion();
  else if (action === 'donor')
    await notify({ level: 'info', title: 'Donor outreach', message: 'TODO' });
}

async function ensureMemory() {
  const notion = getNotion();
  const hq = process.env.NOTION_HQ_PAGE_ID!;
  const title = 'Assistant Memory';
  const res = await notion.search({ query: title, filter: { value: 'page', property: 'object' } });
  const exists = res.results.some(
    // @ts-ignore
    (r) => r.parent?.page_id === hq && r.properties?.title?.title?.[0]?.plain_text === title,
  );
  if (!exists) {
    await notion.pages.create({
      parent: { page_id: hq },
      properties: {
        title: { title: [{ text: { content: title } }] },
      },
    });
  }
}
