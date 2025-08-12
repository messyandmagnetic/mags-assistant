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
import { getProvider, getConfiguredProviders } from '../lib/social/index.js';
import {
  addCommand,
  getCommand,
  getPending,
  updateCommand,
  listCommands,
  resetRunNow,
} from '../lib/command-center.js';
import { runHandler } from '../lib/handlers.js';
import { getStripe } from '../lib/clients/stripe.js';
import { getStorage } from '../lib/storage.ts';
import { spawnSync } from 'child_process';
import { ensureStripeSchema, backfillDefaults } from '../lib/notion-stripe.js';
import { createSpreadsheet, addSheet, appendRows, getDrive } from '../lib/google.js';
import crypto from 'crypto';
import { log as logEntry } from '../lib/logger.js';
import { enqueueNewVideos, handleApprove, handleDecline, autoApproveOld } from '../lib/drive-watcher.js';

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
  const url = new URL(req.url, 'http://x');
  const k =
    req.headers['x-mags-key'] ||
    url.searchParams.get('key') ||
    url.searchParams.get('token');
  if (req.headers['x-vercel-cron']) return true;
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

async function notify(subject, message) {
  try {
    await fetch(`${process.env.API_BASE ?? ''}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `${subject}: ${message}` }),
    });
  } catch {}
}

async function getMasterSheet() {
  const drive = getDrive();
  const q = `name='Master Memory — Messy & Magnetic' and mimeType='application/vnd.google-apps.spreadsheet' and '${env.MM_DRIVE_ROOT_ID}' in parents`;
  const r = await drive.files.list({ q, fields: 'files(id, webViewLink)' });
  return r.data.files && r.data.files[0] ? r.data.files[0] : null;
}

export default async function handler(req, res) {
  const { method, url } = req;
  console.log(`${method} ${url}`);
  try {
    const { pathname } = new URL(url, `http://${req.headers.host}`);

    // health / diag
    if (pathname === '/api/hello') return ok(res, { hello: 'mags' });
    if (pathname === '/api/health' && method === 'GET') {
      return ok(res, {
        time: new Date().toISOString(),
        gitSha: process.env.GIT_SHA || 'dev',
        uptime: process.uptime(),
      });
    }

    if (pathname === '/api/drive/review' && (method === 'GET' || method === 'POST')) {
      if (!checkCron(req)) return bad(res, 'Unauthorized', 401);
      const discovered = await enqueueNewVideos();
      await autoApproveOld();
      return ok(res, { discovered });
    }

    if (pathname === '/api/approve' && (method === 'POST' || method === 'GET')) {
      const { searchParams } = new URL(url, `http://${req.headers.host}`);
      const body = req.body || {};
      const fileId = body.fileId || searchParams.get('fileId');
      const token = body.token || searchParams.get('token');
      try {
        await handleApprove(fileId, token);
        return ok(res, { approved: fileId });
      } catch (err) {
        return bad(res, err.message || 'error', 400);
      }
    }

    if (pathname === '/api/decline' && (method === 'POST' || method === 'GET')) {
      const { searchParams } = new URL(url, `http://${req.headers.host}`);
      const body = req.body || {};
      const fileId = body.fileId || searchParams.get('fileId');
      const token = body.token || searchParams.get('token');
      try {
        await handleDecline(fileId, token);
        return ok(res, { declined: fileId });
      } catch (err) {
        return bad(res, err.message || 'error', 400);
      }
    }
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

    // ===== Bootstrap: create Master Memory sheet =====
    if (pathname === '/api/bootstrap' && method === 'POST') {
      if (!checkKey(req)) return bad(res, 'Unauthorized', 401);
      const title = 'Master Memory — Messy & Magnetic';
      const existing = await getMasterSheet();
      if (existing) return ok(res, existing);
      const { id, webViewLink } = await createSpreadsheet(title, env.MM_DRIVE_ROOT_ID);
      const tabs = [
        'Personal Bio & Preferences',
        'Business & Brand',
        'Retreat & Land Vision',
        'Social Strategy',
        'Automation & Tools',
        'Key Ongoing Goals',
        'To Remove / Outdated',
        'Backups_Index',
      ];
      for (const t of tabs) {
        const headers = t === 'Backups_Index' ? [] : ['Category', 'Detail', 'Last Updated'];
        await addSheet(id, t, headers);
      }
      const seeds = [
        ['Tone', 'Messy & Magnetic', new Date().toISOString()],
        ['Style', 'Authentic & Casual', new Date().toISOString()],
      ];
      await appendRows(id, `${tabs[0]}!A2:C`, seeds);
      return ok(res, { id, url: webViewLink });
    }

    // ===== Tally webhook =====
    if ((pathname === '/api/tally' || pathname === '/api/tally/webhook') && method === 'POST') {
      const secret = env.TALLY_WEBHOOK_SECRET;
      const auth = req.headers['authorization'];
      const sig = req.headers['tally-signature'] || req.headers['x-tally-signature'];
      if (secret) {
        let okSig = false;
        if (auth && auth === `Bearer ${secret}`) {
          okSig = true;
        } else if (sig) {
          const h = crypto
            .createHmac('sha256', secret)
            .update(req.rawBody || '')
            .digest('hex');
          okSig = sig === h;
        }
        if (!okSig) return bad(res, 'Unauthorized', 401);
      }
      const body = typeof req.body === 'object' ? req.body : await readJson(req);
      await logEntry('tally', 'webhook', { formId: body?.formId || body?.event?.formId });
      const sheet = await getMasterSheet();
      if (!sheet) return bad(res, 'Master sheet missing', 500);
      const title = body?.event?.formName || body?.formName;
      let tab = null;
      if (title === 'Soul Blueprint Quiz') tab = 'Orders/Intake';
      if (title === 'Client Feedback') tab = 'Feedback';
      if (tab) {
        try {
          await addSheet(sheet.id, tab, ['Timestamp', 'Data']);
        } catch {}
        await appendRows(sheet.id, `${tab}!A:B`, [[new Date().toISOString(), JSON.stringify(body)]]);
      }
      return ok(res, { received: true });
    }

    // ===== Stripe webhook =====
    if ((pathname === '/api/stripe/webhook' || pathname === '/api/stripe-webhook') && method === 'POST') {
      const secret = env.STRIPE_WEBHOOK_SECRET;
      if (!secret) return bad(res, 'Missing STRIPE_WEBHOOK_SECRET', 500);
      const stripe = getStripe();
      const sig = req.headers['stripe-signature'];
      let event;
      try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, secret);
      } catch (err) {
        console.error('stripe webhook verify failed', err);
        return bad(res, 'Invalid signature', 400);
      }
      await logEntry('stripe', 'event', { type: event.type, id: event.id });
      const sheet = await getMasterSheet();
      if (sheet) {
        try {
          await addSheet(sheet.id, 'Stripe Events', ['Timestamp', 'Type', 'ID']);
        } catch {}
        await appendRows(sheet.id, 'Stripe Events!A:C', [[new Date().toISOString(), event.type, event.id]]);
      }
      return ok(res, { received: true });
    }

    // ===== Telegram webhook =====
    if ((pathname === '/api/telegram' || pathname === '/api/telegram/webhook') && method === 'POST') {
      const token = env.TELEGRAM_BOT_TOKEN;
      if (!token) return bad(res, 'No TELEGRAM_BOT_TOKEN', 501);
      const update = typeof req.body === 'object' ? req.body : await readJson(req);
      const chatId = update?.message?.chat?.id || env.TELEGRAM_CHAT_ID;
      const text = (update?.message?.text || '').trim();
      await logEntry('telegram', 'incoming', { text });
      let reply = null;
      if (text === '/ping') reply = 'pong ✅';
      if (text === '/status') reply = 'ok';
      if (text === '/links') {
        reply = [
          env.NEXT_PUBLIC_SITE_URL || 'https://assistant.messyandmagnetic.com',
          env.MASTER_MEMORY_SHEET_ID || 'memory sheet n/a',
          env.NOTION_HQ_PAGE_ID ? `https://notion.so/${env.NOTION_HQ_PAGE_ID}` : 'notion n/a',
        ].join('\n');
      }
      if (text === '/pricecheck') reply = 'price audit not implemented';
      if (!reply && /quiz|blueprint|email|pdf/i.test(text)) reply = 'job queued';
      if (reply && chatId) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: reply }),
        });
      }
      return ok(res, { received: true });
    }

    if (pathname === '/api/diag/media' && method === 'GET') {
      const ff = spawnSync('ffmpeg', ['-version']);
      const storage = getStorage();
      let storageOk = false;
      try {
        await storage.put(Buffer.from('ok'), 'diag/test.txt');
        storageOk = await storage.exists('diag/test.txt');
      } catch {}
      return ok(res, { ffmpeg: ff.status === 0, storage: storageOk });
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

    // ===== Queue: enqueue =====
    if (pathname === '/api/queue/enqueue' && method === 'POST') {
      if (!checkWorker(req)) return bad(res, 'Unauthorized', 401);
      if (!env.NOTION_QUEUE_DB_ID) return bad(res, 'Missing NOTION_QUEUE_DB_ID');
      const data = await readJson(req).catch(() => ({}));
      const payload = data.payload ? data.payload : data;
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

    // ===== Donations: create $250 link =====
    if (pathname === '/api/donations/create' && method === 'POST') {
      try {
        const body =
          typeof req.body === 'object' ? req.body : await readJson(req);
        const stripe = getStripe();
        let product;
        try {
          const search = await stripe.products.search({
            query: "name:'Nonprofit Filing Support'",
          });
          product = search.data[0];
        } catch {}
        if (!product) {
          product = await stripe.products.create({
            name: 'Nonprofit Filing Support',
          });
        }
        const price = await stripe.prices.create({
          unit_amount: 25000,
          currency: 'usd',
          product: product.id,
        });
        const link = await stripe.paymentLinks.create({
          line_items: [{ price: price.id, quantity: 1 }],
        });
        if (body?.crmId) {
          try {
            await notion.pages.update({
              page_id: body.crmId,
              properties: { 'Stripe Link': { url: link.url } },
            });
          } catch (e) {
            console.error('crm update failed', e);
          }
        }
        await notify('Donation link created', link.url);
        return ok(res, {
          link: link.url,
          priceId: price.id,
          productId: product.id,
        });
      } catch (e) {
        return bad(res, e?.message || 'Error creating link', 500);
      }
    }

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

    // ===== Notion: ensure Stripe schema =====
    if (pathname === '/api/notion/ensure-stripe-schema' && method === 'POST') {
      if (!checkWorker(req)) return bad(res, 'Unauthorized', 401);
      const r = await ensureStripeSchema();
      return ok(res, r);
    }

    // ===== Notion: backfill defaults =====
    if (pathname === '/api/notion/backfill-defaults' && method === 'POST') {
      if (!checkWorker(req)) return bad(res, 'Unauthorized', 401);
      const r = await backfillDefaults();
      return ok(res, r);
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

    // ===== Social: diag =====
    if (pathname === '/api/social/diag' && method === 'GET') {
      if (!checkKey(req)) return bad(res, 'Unauthorized', 401);
      return ok(res, { providers: getConfiguredProviders() });
    }

    // ===== Social: run due =====
    if (pathname === '/api/social/run-due' && method === 'POST') {
      if (!checkCron(req)) return bad(res, 'Unauthorized', 401);
      const databaseId = env.NOTION_SOCIAL_DB;
      if (!databaseId) return bad(res, 'No NOTION_SOCIAL_DB set', 501);
      const now = new Date().toISOString();
      const r = await notion.databases.query({
        database_id: databaseId,
        filter: {
          and: [
            { property: 'Status', status: { equals: 'Scheduled' } },
            { property: 'Scheduled At', date: { on_or_before: now } },
          ],
        },
        page_size: 25,
      });
      const results = [];
      for (const page of r.results) {
        const props = page.properties || {};
        const platform = props['Platform']?.select?.name;
        const caption = (props['Caption']?.rich_text || [])
          .map((t) => t.plain_text)
          .join('');
        const linkUrl = props['LinkURL']?.url || '';
        const mediaUrl = props['AssetURL']?.url || '';
        const postFn = getProvider(platform);
        let okPost = false;
        let response = 'no provider';
        try {
          if (postFn) {
            response = await postFn({ caption, mediaUrl, linkUrl });
            okPost = response !== 'not configured';
          }
        } catch (e) {
          response = e.message || String(e);
        }
        await notion.pages.update({
          page_id: page.id,
          properties: {
            Status: { status: { name: okPost ? 'Posted' : 'Failed' } },
            ResultLog: {
              rich_text: [{ text: { content: String(response).slice(0, 2000) } }],
            },
          },
        });
        await notify(
          `${platform} ${okPost ? 'posted' : 'failed'}`,
          String(response)
        );
        results.push({ id: page.id, ok: okPost, response });
      }
      return ok(res, { count: results.length, results });
    }

    return bad(res, 'Not found', 404);
  } catch (e) {
    console.error(e);
    return bad(res, e.message || 'Server error', 500);
  }
}
