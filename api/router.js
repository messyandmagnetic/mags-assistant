import { notion, requireEnv } from '../lib/notion.js';
import { planFromText } from '../lib/agent/planner.js';
import { runPlan } from '../lib/agent/executor.js';
import { claimJob, runJob, completeJob } from './queue.js';
import { env } from '../lib/env.js';

function ok(res, data) { res.status(200).json({ ok: true, ...data }); }
function bad(res, msg, code = 400) { res.status(code).json({ ok: false, error: msg }); }

function checkKey(req) {
  const k = req.headers['x-mags-key'] || new URL(req.url, 'http://x').searchParams.get('key');
  return k && env.MAGS_KEY && k === env.MAGS_KEY;
}

function checkWorker(req) {
  const k = req.headers['x-worker-key'] || new URL(req.url, 'http://x').searchParams.get('key');
  return k && env.WORKER_KEY && k === env.WORKER_KEY;
}

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  const { method, url } = req;
  console.log(`${method} ${url}`);
  try {
    const { pathname } = new URL(url, `http://${req.headers.host}`);

    // health / diag
    if (pathname === '/api/hello') return ok(res, { hello: 'mags' });
    if (pathname === '/api/rpa/health') return ok(res, {});
    if (pathname === '/api/rpa/diag') {
      return ok(res, {
        haveKeys: {
          notion: !!env.NOTION_TOKEN,
          db: !!env.NOTION_DATABASE_ID,
          inbox: !!env.NOTION_INBOX_PAGE_ID,
          hq: !!env.NOTION_HQ_PAGE_ID,
        },
      });
    }

    if (pathname === '/api/env/summary') {
      return ok(res, {
        haveKeys: {
          notion: !!env.NOTION_TOKEN,
          db: !!env.NOTION_DATABASE_ID,
          inbox: !!env.NOTION_INBOX_PAGE_ID,
          hq: !!env.NOTION_HQ_PAGE_ID,
        },
      });
    }

    // existing rpa/start endpoint
    if (pathname === '/api/rpa/start') {
      if (method === 'POST') {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const target = typeof body.url === 'string' ? body.url.trim() : '';
        try {
          if (!target) throw new Error('missing');
          new URL(target);
        } catch {
          return bad(res, "'url' is required");
        }
        if (env.BROWSERLESS_API_KEY) {
          // await fetch(...)
        }
        return ok(res, {
          started: true,
          url: target,
          jobId: Math.random().toString(36).slice(2, 8),
        });
      }
      return bad(res, 'Method not allowed', 405);
    }

    // ===== Queue: claim job =====
    if (pathname === '/api/queue/claim' && method === 'POST') {
      if (!checkWorker(req)) return bad(res, 'Unauthorized', 401);
      const job = await claimJob();
      if (job) return ok(res, job);
      return ok(res, {});
    }

    // ===== Queue: run job =====
    if (pathname === '/api/queue/run' && method === 'POST') {
      if (!checkWorker(req)) return bad(res, 'Unauthorized', 401);
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const result = await runJob(body);
      if (result.ok) return ok(res, result);
      return bad(res, result.error || 'run failed', 500);
    }

    // ===== Queue: complete job =====
    if (pathname === '/api/queue/complete' && method === 'POST') {
      if (!checkWorker(req)) return bad(res, 'Unauthorized', 401);
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const result = await completeJob(body);
      if (result.ok) return ok(res, result);
      return bad(res, result.error || 'complete failed', 500);
    }

    // secure endpoints
    if (!checkKey(req)) return bad(res, 'Unauthorized', 401);

    // ===== Agent: plan from text =====
    if (pathname === '/api/agent/plan' && method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { text } = body;
      if (!text) return bad(res, 'Missing text');
      const plan = planFromText(text);
      return ok(res, { plan });
    }

    // ===== Agent: command from text =====
    if (pathname === '/api/agent/command' && method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { text } = body;
      if (!text) return bad(res, 'Missing text');
      const plan = planFromText(text);
      const { runId } = await runPlan(plan, { text });
      return ok(res, { jobId: runId });
    }

    // ===== Agent: run explicit plan =====
    if (pathname === '/api/agent/run' && method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { plan, text = '' } = body;
      if (!plan) return bad(res, 'Missing plan');
      const { runId } = await runPlan(plan, { text });
      return ok(res, { jobId: runId });
    }

    // ===== Agent: list jobs =====
    if (pathname === '/api/agent/jobs' && method === 'GET') {
      const db = requireEnv('NOTION_DB_RUNS_ID');
      const r = await notion.databases.query({ database_id: db, page_size: 20, sorts: [{ property: 'Started', direction: 'descending' }] });
      return ok(res, { results: r.results });
    }

    // ===== Agent: logs =====
    if (pathname === '/api/agent/logs' && method === 'GET') {
      const id = new URL(req.url, 'http://x').searchParams.get('id');
      if (!id) return bad(res, 'Missing id');
      const page = await notion.pages.retrieve({ page_id: id });
      const result = page.properties?.Result?.rich_text?.map(r => r.plain_text).join('\n') || '';
      return ok(res, { result });
    }

    // ===== Stripe sync stub =====
    if (pathname === '/api/stripe/sync' && method === 'POST') {
      return ok(res, { synced: false, message: 'Not implemented' });
    }

    // ===== HQ: list children =====
    if (pathname.startsWith('/api/notion/hq/children') && method === 'GET') {
      const pageId = requireEnv('NOTION_HQ_PAGE_ID');
      const r = await notion.blocks.children.list({ block_id: pageId, page_size: 100 });
      return ok(res, { results: r.results });
    }

    // ===== HQ: create subpage =====
    if (pathname.startsWith('/api/notion/hq/subpage') && method === 'POST') {
      const pageId = requireEnv('NOTION_HQ_PAGE_ID');
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const title = body.title || 'New Subpage';
      const page = await notion.pages.create({
        parent: { page_id: pageId },
        properties: { title: [{ type: 'text', text: { content: title } }] },
      });
      return ok(res, { id: page.id, title });
    }

    // ===== HQ: append note =====
    if (pathname.startsWith('/api/notion/hq/note') && method === 'POST') {
      const pageId = requireEnv('NOTION_HQ_PAGE_ID');
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const text = body.text || 'Note from Mags';
      await notion.blocks.children.append({
        block_id: pageId,
        children: [
          {
            paragraph: {
              rich_text: [{ type: 'text', text: { content: text } }],
            },
          },
        ],
      });
      return ok(res, { appended: true });
    }

    // ===== Notion: Tasks (database) =====
    if (pathname.startsWith('/api/notion/tasks')) {
      const databaseId = requireEnv('NOTION_DATABASE_ID');

      if (method === 'GET') {
        const r = await notion.databases.query({
          database_id: databaseId,
          page_size: 50,
          sorts: [{ property: 'Created', direction: 'descending' }].filter(Boolean),
        });
        return ok(res, { count: r.results.length, results: r.results });
      }

      if (method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        const { title, status = 'Todo', notes = '' } = body;
        if (!title) return bad(res, 'Missing title');
        const props = {
          Name: { title: [{ text: { content: title } }] },
        };
        if (notes) props['Notes'] = { rich_text: [{ text: { content: notes } }] };
        if (status) props['Status'] = { status: { name: status } };
        const page = await notion.pages.create({
          parent: { database_id: databaseId },
          properties: props,
        });
        return ok(res, { id: page.id });
      }

      if (method === 'PATCH') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        const { id, status, title, notes } = body;
        if (!id) return bad(res, 'Missing id');
        const props = {};
        if (title) props['Name'] = { title: [{ text: { content: title } }] };
        if (status) props['Status'] = { status: { name: status } };
        if (notes !== undefined) props['Notes'] = { rich_text: [{ text: { content: notes } }] };
        await notion.pages.update({ page_id: id, properties: props });
        return ok(res, { id });
      }

      return bad(res, 'Method not allowed', 405);
    }

    // ===== Notion: Inbox notes (page) =====
    if (pathname.startsWith('/api/notion/notes')) {
      const pageId = env.NOTION_INBOX_PAGE_ID;
      if (!pageId) return bad(res, 'No NOTION_INBOX_PAGE_ID set', 501);

      if (method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        const { text } = body;
        if (!text) return bad(res, 'Missing text');
        await notion.blocks.children.append({
          block_id: pageId,
          children: [
            {
              paragraph: {
                rich_text: [{ type: 'text', text: { content: text } }],
              },
            },
          ],
        });
        return ok(res, { appended: true });
      }

      return bad(res, 'Method not allowed', 405);
    }

    return bad(res, 'Not found', 404);
  } catch (e) {
    console.error(e);
    return bad(res, e.message || 'Server error', 500);
  }
}
