import Stripe from 'stripe';
import { google } from 'googleapis';
import { env } from '../lib/env.js';
import { notion } from '../lib/notion.js';
import { ensureProfileDb } from '../lib/notion_profile.js';

// Disable body parsing so we can handle raw body for Stripe webhook
export const config = { api: { bodyParser: false } };

async function getBody(req) {
  if (req.body) {
    // stringified by server.js in dev
    if (typeof req.body === 'string') {
      req.rawBody = req.body;
      try { return JSON.parse(req.body); } catch { return {}; }
    }
    req.rawBody = JSON.stringify(req.body);
    return req.body;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString();
  req.rawBody = raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

function ok(data = {}) { return { status: 200, body: { ok: true, ...data } }; }
function bad(reason, status = 400, data = {}) { return { status, body: { ok: false, reason, ...data } }; }

// ===== Diag endpoints =====
export async function diag_health() {
  return ok({ time: new Date().toISOString() });
}

export async function diag_notion() {
  const next_steps = [];
  if (!env.NOTION_TOKEN) {
    next_steps.push('Set NOTION_TOKEN');
    return bad('missing NOTION_TOKEN', 200, { next_steps });
  }
  const hq = env.NOTION_HQ_PAGE_ID;
  if (!hq) {
    next_steps.push('Set NOTION_HQ_PAGE_ID');
    return bad('missing NOTION_HQ_PAGE_ID', 200, { next_steps });
  }
  try {
    const profileDbId = await ensureProfileDb({ notion, hqPageId: hq });
    let write = true;
    try {
      const page = await notion.pages.create({
        parent: { database_id: profileDbId },
        properties: {
          Key: { title: [{ text: { content: 'diag-test' } }] },
          Value: { rich_text: [{ text: { content: 'temp' } }] },
        },
      });
      await notion.blocks.delete?.({ block_id: page.id }).catch(() =>
        notion.pages.update({ page_id: page.id, archived: true })
      );
    } catch (e) {
      write = false;
      next_steps.push(
        'Open the HQ page in Notion → ••• → Add connections → pick Maggie/Mags Assistant → Can edit. If a “Profile” DB exists, open it → ••• → Add connections → pick Maggie.'
      );
    }
    return ok({ profileDbId, write, next_steps });
  } catch (e) {
    return bad(e.message, 200, { next_steps });
  }
}

export async function diag_stripe() {
  const next_steps = [];
  if (!env.STRIPE_SECRET_KEY) {
    next_steps.push('Set STRIPE_SECRET_KEY');
    return bad('missing STRIPE_SECRET_KEY', 200, { next_steps });
  }
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  try {
    await stripe.balance.retrieve();
    await stripe.products.list({ limit: 1 });
  } catch (e) {
    return bad(e.message, 200, { next_steps });
  }
  const webhookSet = !!env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSet) next_steps.push('Set STRIPE_WEBHOOK_SECRET');
  return ok({ webhook: webhookSet, next_steps });
}

export async function diag_telegram(req) {
  const next_steps = [];
  if (!env.TELEGRAM_BOT_TOKEN) {
    next_steps.push('Set TELEGRAM_BOT_TOKEN');
    return bad('missing TELEGRAM_BOT_TOKEN', 200, { next_steps });
  }
  const url = new URL(req.url, 'http://x');
  const send = url.searchParams.get('send') === 'true';
  if (send) {
    if (!env.TELEGRAM_CHAT_ID) {
      next_steps.push('Set TELEGRAM_CHAT_ID');
      return bad('missing TELEGRAM_CHAT_ID', 200, { next_steps });
    }
    try {
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: 'diag ping' }),
      });
    } catch (e) {
      return bad(e.message, 200, { next_steps });
    }
  }
  return ok({ sent: send });
}

export async function diag_drive() {
  const next_steps = [];
  const email = process.env.GOOGLE_SERVICE_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key) {
    next_steps.push('Set GOOGLE_SERVICE_EMAIL and GOOGLE_PRIVATE_KEY');
    return bad('missing service account', 200, { next_steps });
  }
  try {
    const auth = new google.auth.JWT(
      email,
      null,
      key,
      ['https://www.googleapis.com/auth/drive.metadata.readonly']
    );
    const drive = google.drive({ version: 'v3', auth });
    await drive.files.list({ pageSize: 1, fields: 'files(id)' });
    return ok();
  } catch (e) {
    return bad(e.message, 200, { next_steps });
  }
}

export async function diag_cron() {
  const secret = env.CRON_SECRET;
  const next_steps = [];
  if (!secret) {
    next_steps.push('Set CRON_SECRET');
    return bad('missing CRON_SECRET', 200, { next_steps });
  }
  const base = process.env.API_BASE || '';
  const mk = (p) => `${base}/api/cron/${p}?secret=${secret}`;
  return ok({
    urls: {
      daily: mk('daily'),
      'stripe-poll': mk('stripe-poll'),
      'gmail-scan': mk('gmail-scan'),
    },
  });
}

// ===== Stripe =====
export async function stripe_audit() {
  const next_steps = [];
  if (!env.STRIPE_SECRET_KEY) {
    next_steps.push('Set STRIPE_SECRET_KEY');
    return bad('missing STRIPE_SECRET_KEY', 200, { next_steps });
  }
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  try {
    await stripe.prices.list({ limit: 1 });
    return ok();
  } catch (e) {
    return bad(e.message, 200, { next_steps });
  }
}

export async function stripe_webhook(req) {
  if (req.method !== 'POST') return bad('method not allowed', 405);
  const sig = req.headers['stripe-signature'];
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return bad('no STRIPE_WEBHOOK_SECRET', 400);
  const stripe = new Stripe(env.STRIPE_SECRET_KEY || '');
  let event;
  try {
    const raw = req.rawBody || (await getBody(req)) && req.rawBody;
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    return bad(e.message, 400);
  }
  switch (event.type) {
    case 'checkout.session.completed':
    case 'payment_intent.succeeded':
      console.log('stripe event', event.type);
      break;
    default:
      break;
  }
  return ok();
}

// ===== Gmail bridge =====
export async function gmail_scan(body) {
  const url = process.env.GMAIL_BRIDGE_URL;
  const secret = process.env.APPS_SCRIPT_SECRET;
  const next_steps = [];
  if (!url || !secret) {
    if (!url) next_steps.push('Set GMAIL_BRIDGE_URL');
    if (!secret) next_steps.push('Set APPS_SCRIPT_SECRET');
    return bad('missing bridge config', 200, { next_steps });
  }
  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(body || {}),
    });
    const data = await r.json().catch(() => ({}));
    return { status: 200, body: { ok: r.ok, data } };
  } catch (e) {
    return bad(e.message, 200, { next_steps });
  }
}

export async function gmail_nudge(body) {
  const url = process.env.GMAIL_BRIDGE_URL;
  const secret = process.env.APPS_SCRIPT_SECRET;
  const next_steps = [];
  if (!url || !secret) {
    if (!url) next_steps.push('Set GMAIL_BRIDGE_URL');
    if (!secret) next_steps.push('Set APPS_SCRIPT_SECRET');
    return bad('missing bridge config', 200, { next_steps });
  }
  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/nudge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(body || {}),
    });
    const data = await r.json().catch(() => ({}));
    return { status: 200, body: { ok: r.ok, data } };
  } catch (e) {
    return bad(e.message, 200, { next_steps });
  }
}

// ===== Cron =====
function checkCronSecret(req) {
  const url = new URL(req.url, 'http://x');
  const secret = url.searchParams.get('secret');
  return secret && secret === env.CRON_SECRET;
}

export async function cron_daily(req) {
  if (!checkCronSecret(req)) return bad('unauthorized', 401);
  return ok();
}

export async function cron_digest(req) {
  if (!checkCronSecret(req)) return bad('unauthorized', 401);
  const url = new URL(req.url, 'http://x');
  const test = url.searchParams.get('test') === 'true';
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    try {
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: `digest${test ? ' test' : ''}` }),
      });
    } catch {}
  }
  return ok();
}

export async function cron_stripe_poll(req) {
  if (!checkCronSecret(req)) return bad('unauthorized', 401);
  return ok();
}

export async function cron_gmail_scan(req) {
  if (!checkCronSecret(req)) return bad('unauthorized', 401);
  return ok();
}

// ===== Admin =====
export async function admin_profile(req) {
  if (req.method !== 'GET') return bad('method not allowed', 405);
  if (!env.NOTION_TOKEN) return bad('missing NOTION_TOKEN', 200);
  const hq = env.NOTION_HQ_PAGE_ID;
  if (!hq) return bad('missing NOTION_HQ_PAGE_ID', 200);
  try {
    const dbId = await ensureProfileDb({ notion, hqPageId: hq });
    const r = await notion.databases.query({ database_id: dbId, page_size: 100 });
    const items = r.results.map((p) => {
      const props = p.properties || {};
      return {
        id: p.id,
        key: props.Key?.title?.[0]?.plain_text || '',
        value: props.Value?.rich_text?.[0]?.plain_text || '',
        visibility: props.Visibility?.select?.name || '',
      };
    });
    return ok({ items });
  } catch (e) {
    return bad(e.message, 200);
  }
}

// ===== Telegram command helpers =====
async function sendTelegram(text) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
  });
}

function parseIntent(text = '') {
  const t = text.toLowerCase();
  if (t.includes('run prospecting')) return 'run_prospecting';
  if (t.includes('gmail scan') || t.startsWith('/scan')) return 'gmail_scan';
  if (t.includes('stripe audit')) return 'stripe_audit';
  if (t.includes('send digest') || t.startsWith('/digest')) return 'send_digest';
  if (t.startsWith('/status') || t.includes('status')) return 'status';
  if (t.startsWith('/pause') || t.includes('pause')) return 'pause';
  if (t.startsWith('/resume') || t.includes('resume')) return 'resume';
  return 'free';
}

async function handleIntent(intent) {
  switch (intent) {
    case 'gmail_scan':
      return gmail_scan();
    case 'stripe_audit':
      return stripe_audit();
    case 'send_digest':
      return cron_digest({ url: '/api/router?action=cron_digest' });
    case 'status':
      return ok({ message: `${process.env.API_BASE || ''}/check` });
    case 'pause':
    case 'resume':
      return ok({ message: intent });
    default:
      return ok({ message: 'noted' });
  }
}

export async function telegram_command(req) {
  const body = await getBody(req);
  const text = body.text || '';
  const intent = parseIntent(text);
  const result = await handleIntent(intent);
  await sendTelegram(`command: ${intent}`);
  return result;
}

export async function telegram_webhook(req) {
  const body = await getBody(req);
  const msg = body.message;
  if (msg && String(msg.chat?.id) === String(env.TELEGRAM_CHAT_ID)) {
    const text = msg.text || '';
    const intent = parseIntent(text);
    const result = await handleIntent(intent);
    await sendTelegram(`command: ${intent}`);
    return result;
  }
  return ok();
}

export async function telegram_poll(req) {
  const url = new URL(req.url, 'http://x');
  const secret = url.searchParams.get('secret');
  if (secret !== env.CRON_SECRET) return bad('unauthorized', 401);
  if (!env.TELEGRAM_BOT_TOKEN) return bad('missing TELEGRAM_BOT_TOKEN', 200);
  const updates = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getUpdates`).then(r => r.json()).catch(() => ({result:[]}));
  for (const u of updates.result || []) {
    const msg = u.message;
    if (msg && String(msg.chat?.id) === String(env.TELEGRAM_CHAT_ID)) {
      const intent = parseIntent(msg.text || '');
      await handleIntent(intent);
      await sendTelegram(`command: ${intent}`);
    }
  }
  return ok();
}

// ===== Main router =====
export default async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  let action = url.searchParams.get('action');
  const parts = url.pathname.split('/');
  if (!action && parts.length > 3) action = parts[3]; // /api/router/:action

  let result;
  try {
    switch (action) {
      case 'diag_health':
        result = await diag_health();
        break;
      case 'diag_notion':
        result = await diag_notion();
        break;
      case 'diag_stripe':
        result = await diag_stripe();
        break;
      case 'diag_telegram':
        result = await diag_telegram(req);
        break;
      case 'diag_drive':
        result = await diag_drive();
        break;
      case 'diag_cron':
        result = await diag_cron();
        break;
      case 'stripe_audit':
        result = await stripe_audit();
        break;
      case 'stripe_webhook':
        result = await stripe_webhook(req);
        break;
      case 'gmail_scan':
        result = await gmail_scan(await getBody(req));
        break;
      case 'gmail_nudge':
        result = await gmail_nudge(await getBody(req));
        break;
      case 'cron_daily':
        result = await cron_daily(req);
        break;
      case 'cron_digest':
        result = await cron_digest(req);
        break;
      case 'cron_stripe_poll':
        result = await cron_stripe_poll(req);
        break;
      case 'cron_gmail_scan':
        result = await cron_gmail_scan(req);
        break;
      case 'admin_profile':
        result = await admin_profile(req);
        break;
      case 'telegram_command':
        result = await telegram_command(req);
        break;
      case 'telegram_webhook':
        result = await telegram_webhook(req);
        break;
      case 'telegram_poll':
        result = await telegram_poll(req);
        break;
      default:
        result = bad('not found', 404);
    }
  } catch (e) {
    console.error(e);
    result = bad(e.message || 'server error', 500);
  }
  res.status(result.status).json(result.body);
}

