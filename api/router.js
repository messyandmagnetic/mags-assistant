import { notion, requireEnv } from '../lib/notion.js';
import { createTask, getDueTask, markTaskStatus } from '../lib/notion-queue.js';

function ok(res, data) { res.status(200).json({ ok: true, ...data }); }
function bad(res, msg, code = 400) { res.status(code).json({ ok: false, error: msg }); }

function checkKey(req) {
  const k = req.headers['x-mags-key'] || new URL(req.url, 'http://x').searchParams.get('key');
  return k && process.env.MAGS_KEY && k === process.env.MAGS_KEY;
}

function checkWorkerKey(req) {
  const k = req.headers['x-worker-key'];
  return k && process.env.WORKER_KEY && k === process.env.WORKER_KEY;
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
          notion: !!process.env.NOTION_TOKEN,
          db: !!process.env.NOTION_DATABASE_ID,
          inbox: !!process.env.NOTION_INBOX_PAGE_ID,
          hq: !!process.env.NOTION_HQ_PAGE_ID,
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
        if (process.env.BROWSERLESS_API_KEY) {
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

    // ===== Queue: claim next job =====
    if (pathname === '/api/queue/claim') {
      if (!checkWorkerKey(req)) return bad(res, 'Unauthorized', 401);
      if (method !== 'POST') return bad(res, 'Method not allowed', 405);
      const job = await getDueTask();
      if (!job) return ok(res, { job: null });
      await markTaskStatus(job.id, 'Running');
      return ok(res, { job });
    }

    // ===== Queue: finish job =====
    if (pathname === '/api/queue/finish') {
      if (!checkWorkerKey(req)) return bad(res, 'Unauthorized', 401);
      if (method !== 'POST') return bad(res, 'Method not allowed', 405);
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { id, status, result = '', viewerURL = '' } = body;
      if (!id || !status) return bad(res, 'Missing id or status');
      await markTaskStatus(id, status, result, viewerURL);
      return ok(res, { id });
    }

    // secure endpoints
    if (!checkKey(req)) return bad(res, 'Unauthorized', 401);

    // ===== Queue: add job =====
    if (pathname === '/api/queue/add' && method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { text, when, runner } = body;
      if (!text) return bad(res, 'Missing text');
      const r = await createTask({ text, when, runner });
      return ok(res, { id: r.id });
    }

    // ===== Queue: peek upcoming =====
    if (pathname === '/api/queue/peek' && method === 'GET') {
      const r = await notion.databases.query({
        database_id: requireEnv('NOTION_DB_TASKS_ID'),
        filter: {
          or: [
            { property: 'Status', status: { equals: 'Todo' } },
            { property: 'Status', status: { equals: 'Running' } },
          ],
        },
        sorts: [{ property: 'When', direction: 'ascending' }],
        page_size: 20,
      });
      const jobs = r.results.map((p) => ({
        id: p.id,
        text: p.properties?.Command?.rich_text?.[0]?.plain_text || '',
        when: p.properties?.When?.date?.start || null,
        status: p.properties?.Status?.status?.name || '',
        runner: p.properties?.Runner?.rich_text?.[0]?.plain_text || 'browserless',
      }));
      return ok(res, { jobs });
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
      const pageId = process.env.NOTION_INBOX_PAGE_ID;
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
