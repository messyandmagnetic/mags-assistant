import {
  notion,
  requireEnv,
  enqueueTask,
  claimNextTask,
  completeTask,
  failTask,
  queueHealth,
  readTask,
  ensureQueueDb,
  enqueueJob,
} from '../lib/notion.js';
import { planFromText } from '../lib/agent/planner.js';
import { runPlan } from '../lib/agent/executor.js';
import { env } from '../lib/env.js';
import {
  addCommand,
  getCommand,
  getPending,
  updateCommand,
  listCommands,
  resetRunNow,
} from '../lib/command-center.js';
import { runHandler } from '../lib/handlers.js';

// guardrail state
const rateLimit = new Map(); // ip -> {count, ts}
let paused = env.EXECUTION_PAUSED;

function checkRate(req, limit = 5) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local';
  const now = Date.now();
  const entry = rateLimit.get(ip) || { count: 0, ts: now };
  if (now - entry.ts > 60000) {
    entry.count = 0;
    entry.ts = now;
  }
  entry.count += 1;
  rateLimit.set(ip, entry);
  return entry.count <= limit;
}

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

function checkCron(req) {
  const k = req.headers['x-mags-key'] || new URL(req.url, 'http://x').searchParams.get('key');
  return k && env.CRON_SECRET && k === env.CRON_SECRET;
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString() || '{}');
  } catch {
    return {};
  }
}

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  const { method, url } = req;
  console.log(`${method} ${url}`);
  try {
    const { pathname } = new URL(url, `http://${req.headers.host}`);

    // health / diag
    if (pathname === '/api/hello') return ok(res, { hello: 'mags' });
    if (pathname === '/api/rpa/health') {
      if (!checkKey(req)) return bad(res, 'Unauthorized', 401);
      return ok(res, {});
    }
    if (pathname === '/api/rpa/diag') {
      if (!checkKey(req)) return bad(res, 'Unauthorized', 401);
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

    // ===== Commands: run =====
    if (pathname === '/api/commands/run' && method === 'POST') {
      if (!checkRate(req)) return bad(res, 'Rate limit', 429);
      const body =
        req.body && typeof req.body === 'object' ? req.body : await readJson(req);
      let cmd;
      if (body.id) {
        cmd = getCommand(body.id);
        if (!cmd) return bad(res, 'Not found', 404);
      } else {
        cmd = addCommand(body.command || '', body.args || '');
      }
      try {
        updateCommand(cmd.id, { status: 'Running' });
        const result = await runHandler(cmd.command, cmd.args);
        updateCommand(cmd.id, {
          status: 'Succeeded',
          output: result,
          runNow: false,
        });
        return ok(res, { id: cmd.id, status: 'Succeeded', result });
      } catch (e) {
        updateCommand(cmd.id, {
          status: 'Failed',
          output: e.message,
          runNow: false,
        });
        return bad(res, e.message || 'Error', 500);
      }
    }

    // ===== Commands: logs =====
    if (pathname === '/api/commands/logs' && method === 'GET') {
      const logs = listCommands().slice(-10).reverse();
      return ok(res, { logs });
    }

    // ===== Commands: scan =====
    if (pathname === '/api/commands/scan' && method === 'POST') {
      if (!checkCron(req)) return bad(res, 'Unauthorized', 401);
      if (paused) return ok(res, { paused: true });
      const pending = getPending();
      const results = [];
      for (const cmd of pending) {
        try {
          updateCommand(cmd.id, { status: 'Running' });
          const r = await runHandler(cmd.command, cmd.args);
          updateCommand(cmd.id, { status: 'Succeeded', output: r });
          resetRunNow(cmd.id);
          results.push({ id: cmd.id, ok: true });
        } catch (e) {
          updateCommand(cmd.id, { status: 'Failed', output: e.message });
          resetRunNow(cmd.id);
          results.push({ id: cmd.id, ok: false, error: e.message });
        }
      }
      return ok(res, { count: results.length, results });
    }

    // ===== Commands: pause/resume =====
    if (pathname === '/api/commands/pause' && method === 'POST') {
      if (!checkCron(req)) return bad(res, 'Unauthorized', 401);
      paused = true;
      return ok(res, { paused: true });
    }
    if (pathname === '/api/commands/resume' && method === 'POST') {
      if (!checkCron(req)) return bad(res, 'Unauthorized', 401);
      paused = false;
      return ok(res, { paused: false });
    }

    // existing rpa/start endpoint
    if (pathname === '/api/rpa/start') {
      if (!checkKey(req)) return bad(res, 'Unauthorized', 401);
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

    // ===== Queue: list =====
    if (pathname === '/api/queue/list' && method === 'GET') {
      if (!env.NOTION_QUEUE_DB_ID) return bad(res, 'Missing NOTION_QUEUE_DB_ID');
      const r = await notion.databases.query({
        database_id: env.NOTION_QUEUE_DB_ID,
        page_size: 50,
        sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
      });
      const results = r.results.map((page) => {
        const props = page.properties || {};
        return {
          id: page.id,
          title:
            props.Title?.title?.[0]?.plain_text ||
            props['Job Name']?.title?.[0]?.plain_text ||
            'Untitled',
          status: props.Status?.select?.name || 'Unknown',
          lastLog:
            props['Result / Notes']?.rich_text?.map((r) => r.plain_text).join('\n') ||
            props.Payload?.rich_text?.map((r) => r.plain_text).join('\n') ||
            '',
          updated: page.last_edited_time,
          url: page.url,
        };
      });
      return ok(res, { results });
    }

    // ===== Queue: enqueue =====
    if (pathname === '/api/queue/enqueue' && method === 'POST') {
      if (req.headers['x-mags-key'] !== env.MAGS_KEY) return bad(res, 'Unauthorized', 401);
      if (!env.NOTION_QUEUE_DB_ID) return bad(res, 'Missing NOTION_QUEUE_DB_ID');
      const data = await readJson(req).catch(() => ({}));
      const payload = data?.payload ?? {};
      const jobId = `job_${Date.now()}`;
      const page = await enqueueTask({ jobId, payload });
      return ok(res, { id: jobId, pageId: page?.id ?? null });
    }

    // ===== Queue: seed job queue =====
    if (pathname === '/api/queue/seed' && method === 'POST') {
      if (req.headers['x-mags-key'] !== env.CRON_SECRET)
        return bad(res, 'Unauthorized', 401);
      const parentPageId = env.NOTION_HQ_PAGE_ID;
      if (!parentPageId) return bad(res, 'Missing NOTION_HQ_PAGE_ID');
      const { databaseId } = await ensureQueueDb({ parentPageId });

      if (!env.NOTION_QUEUE_DB) {
        try {
          if (process.env.VERCEL_PROJECT_ID && process.env.VERCEL_API_TOKEN) {
            await fetch(
              `https://api.vercel.com/v9/projects/${process.env.VERCEL_PROJECT_ID}/env`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  key: 'NOTION_QUEUE_DB',
                  value: databaseId,
                  target: ['production', 'preview', 'development'],
                }),
              }
            );
          }
          process.env.NOTION_QUEUE_DB = databaseId;
        } catch (e) {
          console.error('Failed to set Vercel env', e);
        }
      }

      const parameters = `Update all Stripe product images and advanced settings to the final Messy & Magnetic branding.

Tasks:
1) Fix incomplete descriptions using “MM Site Content” in Notion.
2) Upload final product images from the brand folder.
3) Ensure advanced settings are correct for each product (metadata keys, unit label, tax behavior, shippable flags if any, statement descriptor where needed).
4) Set up donation products and link to correct price IDs (one‑time + monthly).
5) Normalize naming, descriptions, and visibility to match the approved product templates in Notion.
Output:
- List of product IDs updated
- Any products skipped with reason
- Links to new images
`;

      const { id: jobId } = await enqueueJob({
        databaseId,
        name: 'Update Stripe Products & Donations',
        parameters,
      });

      return ok(res, { databaseId, jobId });
    }

    // ===== Queue: claim =====
    if (pathname === '/api/queue/claim' && method === 'POST') {
      if (!checkWorker(req)) return bad(res, 'Unauthorized', 401);
      if (!env.NOTION_QUEUE_DB_ID) return bad(res, 'Missing NOTION_QUEUE_DB_ID');
      const page = await claimNextTask();
      if (!page) return ok(res, { id: null });
      return ok(res, readTask(page));
    }

    // ===== Queue: complete =====
    if (pathname === '/api/queue/complete' && method === 'POST') {
      if (!checkWorker(req)) return bad(res, 'Unauthorized', 401);
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (!body.id) return bad(res, 'Missing id');
      await completeTask(body.id);
      return ok(res, { id: body.id });
    }

    // ===== Queue: fail =====
    if (pathname === '/api/queue/fail' && method === 'POST') {
      if (!checkWorker(req)) return bad(res, 'Unauthorized', 401);
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (!body.id) return bad(res, 'Missing id');
      await failTask(body.id, body.error || 'error');
      return ok(res, { id: body.id });
    }

    // ===== Queue: health =====
    if (pathname === '/api/queue/health' && method === 'GET') {
      if (!checkWorker(req)) return bad(res, 'Unauthorized', 401);
      await queueHealth();
      return ok(res, {});
    }

    // ===== Run job =====
    if (pathname === '/api/run' && method === 'POST') {
      if (!checkWorker(req)) return bad(res, 'Unauthorized', 401);
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { id, task, type = 'ops', data } = body;
      if (!id) return bad(res, 'Missing id');
      try {
        switch (type) {
          case 'social-post':
            console.log('social-post', task, data);
            break;
          case 'notion-maint':
          case 'sync':
          case 'crawl':
          case 'plan':
          case 'ops':
          default:
            console.log('run', type, task);
            break;
        }
        await completeTask(id);
        return ok(res, { id });
      } catch (err) {
        await failTask(id, err?.message || String(err));
        return bad(res, err?.message || 'run failed', 500);
      }
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
