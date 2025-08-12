import { Client } from '@notionhq/client';

const json = (obj, status=200) => new Response(JSON.stringify(obj), {status, headers:{'content-type':'application/json'}});

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname, searchParams } = url;
    const method = request.method;
    const requirePass = () => {
      if (request.headers.get('x-fetch-pass') !== env.FETCH_PASS) {
        return json({ ok: false, error: 'unauthorized' }, 401);
      }
    };

    if (pathname === '/api/health' && method === 'GET') {
      return json({ ok: true });
    }

    if (pathname === '/api/cron/heartbeat' && method === 'GET') {
      await env.STATUS_KV?.put('last_heartbeat', Date.now().toString());
      return json({ ok: true });
    }

    if (pathname === '/api/cron/publish-queue' && method === 'POST') {
      const unauthorized = requirePass();
      if (unauthorized) return unauthorized;
      const dry = searchParams.get('dry');
      const items = await fetchReady(env);
      if (!dry) await queueItems(items, env);
      return json({ ok: true, count: items.length, dry: Boolean(dry) });
    }

    if (pathname === '/api/queue/head' && method === 'GET') {
      const items = await getQueued(env);
      return json({ ok: true, items: items.slice(0,5) });
    }

    if (pathname === '/api/media/new' && method === 'POST') {
      const unauthorized = requirePass();
      if (unauthorized) return unauthorized;
      const body = await request.json();
      ctx.waitUntil(env.POST_QUEUE.send(body));
      return json({ ok: true });
    }

    if (pathname === '/api/notion/changed' && method === 'POST') {
      const body = await request.json();
      await env.STATUS_KV?.put(`notion:${body.id}`, JSON.stringify(body));
      ctx.waitUntil(env.POST_QUEUE?.send({ event: 'notion', body }));
      return json({ ok: true });
    }

    if (pathname === '/api/telegram/webhook' && method === 'POST') {
      const update = await request.json();
      const message = update?.message?.text || '';
      const chatId = update?.message?.chat?.id || env.TELEGRAM_CHAT_ID;
      const reply = async (text) => {
        if (!env.TELEGRAM_BOT_TOKEN || !chatId) return;
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text })
        });
      };
      if (message.startsWith('/status')) {
        const r = await fetch(new URL('/api/health', url.origin).toString());
        const j = await r.json();
        await reply(j.ok ? 'OK' : 'FAIL');
      } else if (message.startsWith('/queue')) {
        const items = await getQueued(env);
        const text = items.slice(0,5).map(i=>`- ${i.title} at ${i.time}`).join('\n') || 'empty';
        await reply(text);
      } else if (message.startsWith('/reschedule')) {
        const parts = message.split(/\s+/);
        if (parts.length >=3) {
          await updateTime(env, parts[1], parts[2]);
          await reply('rescheduled');
        }
      } else if (message.startsWith('/promote')) {
        const parts = message.split(/\s+/);
        if (parts.length >=2) {
          await promote(env, parts[1]);
          await reply('promoted');
        }
      }
      return json({ ok: true });
    }

    return new Response('Not found', { status: 404 });
  },

  async queue(batch, env) {
    for (const msg of batch.messages) {
      try {
        // placeholder for processing media
        await env.STATUS_KV?.put('last_media', Date.now().toString());
        msg.ack();
      } catch (e) {
        msg.retry();
      }
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(processPublishQueue(env));
  }
};

async function processPublishQueue(env) {
  const items = await fetchReady(env);
  await queueItems(items, env);
}

async function fetchReady(env) {
  if (!env.NOTION_TOKEN || !env.NOTION_DB_SCHEDULER) return [];
  const notion = new Client({ auth: env.NOTION_TOKEN });
  const res = await notion.databases.query({
    database_id: env.NOTION_DB_SCHEDULER,
    filter: { property: 'Status', select: { equals: 'Ready' } }
  });
  return res.results.map((p:any)=>({ id:p.id, title:p.properties.Title?.title?.[0]?.plain_text || 'untitled', time:p.properties.BestTime?.rich_text?.[0]?.plain_text || '' }));
}

async function queueItems(items:any[], env:any) {
  if (!env.NOTION_TOKEN) return;
  const notion = new Client({ auth: env.NOTION_TOKEN });
  for (const it of items) {
    await notion.pages.update({ page_id: it.id, properties: { Status: { select: { name: 'Queued' } } } });
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: `Queued: ${it.title}` })
      });
    }
  }
}

async function getQueued(env:any) {
  if (!env.NOTION_TOKEN || !env.NOTION_DB_SCHEDULER) return [];
  const notion = new Client({ auth: env.NOTION_TOKEN });
  const res = await notion.databases.query({
    database_id: env.NOTION_DB_SCHEDULER,
    filter: { property: 'Status', select: { equals: 'Queued' } },
    sorts: [{ property: 'BestTime', direction: 'ascending' }]
  });
  return res.results.map((p:any)=>({ id:p.id, title:p.properties.Title?.title?.[0]?.plain_text || 'untitled', time:p.properties.BestTime?.rich_text?.[0]?.plain_text || '' }));
}

async function updateTime(env:any, id:string, time:string) {
  if (!env.NOTION_TOKEN) return;
  const notion = new Client({ auth: env.NOTION_TOKEN });
  await notion.pages.update({ page_id: id, properties: { BestTime: { rich_text: [{ text: { content: time } }] } } });
}

async function promote(env:any, id:string) {
  if (!env.NOTION_TOKEN) return;
  const notion = new Client({ auth: env.NOTION_TOKEN });
  await notion.pages.update({ page_id: id, properties: { Status: { select: { name: 'Posted' } } } });
}
