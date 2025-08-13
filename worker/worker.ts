// Cloudflare Worker implementing health, land operations, stripe ingest and digests

type Env = {
  FETCH_PASS?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  NOTION_TOKEN?: string;
  NOTION_DATABASE_ID?: string;
  GOOGLE_CLIENT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY_P1?: string;
  GOOGLE_PRIVATE_KEY_P2?: string;
  GOOGLE_PRIVATE_KEY_P3?: string;
  GOOGLE_PRIVATE_KEY_P4?: string;
};

function json(status: number, body: unknown, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}
const ok = (b: unknown = {}) => json(200, { ok: true, ...b });
const bad = (msg: string, code = 400) => json(code, { ok: false, error: msg });

function has(v?: string) {
  return !!(v && v.trim().length > 0);
}

async function requireAuth(req: Request, env: Env) {
  if (!env.FETCH_PASS) return true;
  const pass = req.headers.get('X-Fetch-Pass');
  return pass === env.FETCH_PASS;
}

async function sendTelegram(env: Env, text: string) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID)
    return { sent: false, reason: 'telegram_not_configured' };
  const u = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const r = await fetch(u, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
  });
  const js = await r.json().catch(() => ({}));
  return { sent: r.ok, status: r.status, body: js };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const p = url.pathname;
    const method = req.method;

    // open health check
    if (method === 'GET' && p === '/health') {
      return ok({ ts: Date.now() });
    }

    // gate all other routes when FETCH_PASS is set
    const allowed = await requireAuth(req, env);
    if (!allowed) return bad('unauthorized', 401);

    if (method === 'GET' && p === '/status') {
      const present = {
        NOTION_TOKEN: has(env.NOTION_TOKEN),
        NOTION_DATABASE_ID: has(env.NOTION_DATABASE_ID),
        GOOGLE_CLIENT_EMAIL: has(env.GOOGLE_CLIENT_EMAIL),
        GOOGLE_PRIVATE_KEY_P1: has(env.GOOGLE_PRIVATE_KEY_P1),
        TELEGRAM_BOT_TOKEN: has(env.TELEGRAM_BOT_TOKEN),
        TELEGRAM_CHAT_ID: has(env.TELEGRAM_CHAT_ID),
      };
      return ok({ present, now: new Date().toISOString() });
    }

    if (method === 'POST' && p === '/land/scan') {
      if (!env.GOOGLE_CLIENT_EMAIL) return bad('MISSING_GOOGLE_CLIENT_EMAIL');
      if (!env.GOOGLE_PRIVATE_KEY_P1) return bad('MISSING_GOOGLE_PRIVATE_KEY');
      return ok({ scanned: 0 });
    }

    if (method === 'POST' && p === '/land/summary') {
      if (!env.NOTION_TOKEN) return bad('MISSING_NOTION_TOKEN');
      if (!env.NOTION_DATABASE_ID) return bad('MISSING_NOTION_DATABASE_ID');
      return ok({ summarized: 0 });
    }

    if (method === 'POST' && p === '/stripe/ingest') {
      const payload = await req.json().catch(() => ({}));
      return ok({ received: payload.type || null });
    }

    if (method === 'POST' && p === '/digest') {
      const msg =
        `Mags status\n` +
        `• Time: ${new Date().toISOString()}`;
      const tg = await sendTelegram(env, msg);
      return ok({ telegram: tg });
    }

    return bad('NOT_FOUND', 404);
  },
} satisfies ExportedHandler<Env>;
