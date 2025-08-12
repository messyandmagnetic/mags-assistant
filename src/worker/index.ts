import { runAgent } from '../agent/dispatcher';

export default {
  async fetch(request: Request, env: Record<string, any>): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    const GOOGLE_PRIVATE_KEY =
      (env.GOOGLE_PRIVATE_KEY_P1 || '') +
      (env.GOOGLE_PRIVATE_KEY_P2 || '') +
      (env.GOOGLE_PRIVATE_KEY_P3 || '') +
      (env.GOOGLE_PRIVATE_KEY_P4 || '');

    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-Fetch-Pass, tally-webhook-secret',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const json = (obj: any, status = 200) =>
      new Response(JSON.stringify(obj), {
        status,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });

    // optional agent gate
    if (pathname.startsWith('/agent') && env.FETCH_PASS) {
      const pass = request.headers.get('X-Fetch-Pass');
      if (pass !== env.FETCH_PASS) {
        return json({ ok: false, error: 'forbidden' }, 401);
      }
    }

    if (pathname === '/health' && method === 'GET') {
      return json({ ok: true, worker: 'online' });
    }

    // Telegram webhook
    if (pathname === '/api/telegram' && method === 'POST') {
      const update = await request.json();
      const message: string = update?.message?.text || '';
      const chatId = update?.message?.chat?.id;
      const reply = async (text: string) => {
        if (!env.TELEGRAM_BOT_TOKEN || !chatId) return;
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text }),
        });
      };
      if (message.startsWith('/ping')) {
        await reply('pong');
      } else if (message.startsWith('/help')) {
        await reply('Commands: /ping, /sync, /audit');
      } else if (message.startsWith('/sync')) {
        const r = await fetch(new URL('/agent/sync/stripe-to-notion', request.url).toString(), {
          method: 'POST',
          headers: env.FETCH_PASS ? { 'X-Fetch-Pass': env.FETCH_PASS } : undefined,
        });
        const j = await r.json().catch(() => ({ ok: false }));
        await reply(j.ok ? 'Sync complete' : 'Sync failed');
      } else if (message.startsWith('/audit')) {
        const r = await fetch(new URL('/agent/audit/prices', request.url).toString(), {
          method: 'POST',
          headers: env.FETCH_PASS ? { 'X-Fetch-Pass': env.FETCH_PASS } : undefined,
        });
        const j = await r.json().catch(() => ({ ok: false }));
        await reply(j.ok ? 'Audit complete' : 'Audit failed');
      }
      return json({ ok: true });
    }

    if (pathname === '/agent/sync/stripe-to-notion' && method === 'POST') {
      const payload = await request.json().catch(() => ({}));
      const result = await runAgent('sync/stripe-to-notion', payload, env);
      return json(result, result.ok ? 200 : 500);
    }

    if (pathname === '/agent/audit/prices' && method === 'POST') {
      const payload = await request.json().catch(() => ({}));
      const result = await runAgent('audit/prices', payload, env);
      return json(result, result.ok ? 200 : 500);
    }

    if (pathname === '/agent/tally/ingest' && method === 'POST') {
      const sig = request.headers.get('tally-webhook-secret');
      if (env.TALLY_WEBHOOK_SECRET && sig !== env.TALLY_WEBHOOK_SECRET) {
        return json({ ok: false, error: 'unauthorized' }, 401);
      }
      const payload = await request.json().catch(() => ({}));
      const result = await runAgent('tally/ingest', payload, env);
      return json(result, result.ok ? 200 : 500);
    }

    return new Response('Not found', { status: 404, headers: cors });
  },
};
