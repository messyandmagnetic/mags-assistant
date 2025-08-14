// Cloudflare Worker implementing health, status, stripe audit, digest routes
import { handleTallyIntake, handleBackfill } from './routes/tally';
import { handleTallyTest } from './routes/tally_test';

type Env = {
  FETCH_PASS?: string;
  DEV_MODE?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  NOTION_TOKEN?: string;
  GOOGLE_CLIENT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY_P1?: string;
  GOOGLE_PRIVATE_KEY_P2?: string;
  GOOGLE_PRIVATE_KEY_P3?: string;
  GOOGLE_PRIVATE_KEY_P4?: string;
  GENERAL_ONE_TIME_HINT?: string;
  GENERAL_MONTHLY_HINT?: string;
  FILING_250_HINT?: string;
  TALLY_WEBHOOK_SECRET?: string;
  GAS_INTAKE_URL?: string;
};

function json(status: number, body: unknown, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}
const ok = (b: unknown = {}) => json(200, { ok: true, ...b });
const bad = (msg: string, code = 400) => json(code, { ok: false, error: msg });

async function requirePass(req: Request, env: Env) {
  if (env.DEV_MODE === 'true') return true;
  const pass = req.headers.get('X-Fetch-Pass');
  return !!env.FETCH_PASS && pass === env.FETCH_PASS;
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

function has(v?: string) {
  return !!(v && v.trim().length > 0);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const p = url.pathname;

    // GET /health
    if (req.method === 'GET' && p === '/health') {
      let gas: number | string = 'missing';
      if (env.GAS_INTAKE_URL) {
        try {
          const r = await fetch(env.GAS_INTAKE_URL + '?action=health');
          gas = r.ok ? 200 : r.status;
        } catch (err) {
          gas = 'error';
        }
      }
      return json(200, { ok: gas === 200, upstreams: { gas } });
    }

    if (req.method === 'GET' && p === '/tally/test') {
      return handleTallyTest(req, env);
    }

    if (req.method === 'POST' && p === '/tally-intake') {
      return handleTallyIntake(req, env);
    }

    if (req.method === 'POST' && p === '/tally/webhook') {
      const gas = env.GAS_INTAKE_URL;
      if (!gas) return bad('missing_gas_intake_url', 500);
      const body = await req.text();
      const headers = new Headers();
      req.headers.forEach((v, k) => {
        if (k === 'content-type' || k.startsWith('tally') || k.startsWith('x-tally')) {
          headers.set(k, v);
        }
      });
      try {
        const r = await fetch(gas, { method: 'POST', body, headers });
        const txt = await r.text();
        console.log(`tally/webhook -> ${r.status}`);
        return new Response(txt, { status: r.status });
      } catch (err) {
        console.log('tally/webhook_error');
        return bad('forward_failed', 500);
      }
    }

    if (req.method === 'POST' && p === '/logs') {
      if (env.WORKER_KEY) {
        const k = req.headers.get('x-worker-key');
        if (k !== env.WORKER_KEY) return bad('unauthorized', 401);
      }
      const body = await req.text();
      console.log('log', body);
      return ok();
    }

    if (req.method === 'POST' && p === '/backfill') {
      return handleBackfill(req, env);
    }

    // All POST routes gated
    if (req.method === 'POST') {
      const allowed = await requirePass(req, env);
      if (!allowed) return bad('UNAUTHORIZED_OR_MISSING_FETCH_PASS', 401);

      // POST /status
      if (p === '/status') {
        const present = {
          FETCH_PASS: has(env.FETCH_PASS),
          STRIPE_WEBHOOK_SECRET: has(env.STRIPE_WEBHOOK_SECRET),
          NOTION_TOKEN: has(env.NOTION_TOKEN),
          GOOGLE_CLIENT_EMAIL: has(env.GOOGLE_CLIENT_EMAIL),
          GOOGLE_PRIVATE_KEY_P1: has(env.GOOGLE_PRIVATE_KEY_P1),
          TELEGRAM_BOT_TOKEN: has(env.TELEGRAM_BOT_TOKEN),
          TELEGRAM_CHAT_ID: has(env.TELEGRAM_CHAT_ID),
          GENERAL_ONE_TIME_HINT: has(env.GENERAL_ONE_TIME_HINT),
          GENERAL_MONTHLY_HINT: has(env.GENERAL_MONTHLY_HINT),
          FILING_250_HINT: has(env.FILING_250_HINT),
        };
        return ok({
          present,
          now: new Date().toISOString(),
          service: 'cloudflare-worker',
        });
      }

      // POST /stripe/audit (no live Stripe calls; echo configured link hints)
      if (p === '/stripe/audit') {
        const links = {
          oneTime: env.GENERAL_ONE_TIME_HINT || '',
          monthly: env.GENERAL_MONTHLY_HINT || '',
          filing250: env.FILING_250_HINT || '',
        };
        const completeness = {
          oneTime: !!links.oneTime,
          monthly: !!links.monthly,
          filing250: !!links.filing250,
        };
        return ok({ links, completeness });
      }

      // POST /brain/sync
      if (p === '/brain/sync') {
        return ok({ triggered: false, reason: 'not_configured' });
      }

      // POST /digest — send a tiny status to Telegram if configured
      if (p === '/digest') {
        const msg =
          `Mags status:\n` +
          `• Worker: ok\n` +
          `• Time: ${new Date().toISOString()}\n` +
          `• Stripe hints: ${has(env.GENERAL_ONE_TIME_HINT) ? 'set' : 'missing'} / ${
            has(env.GENERAL_MONTHLY_HINT) ? 'set' : 'missing'
          } / ${has(env.FILING_250_HINT) ? 'set' : 'missing'}`;
        const tg = await sendTelegram(env, msg);
        return ok({ telegram: tg });
      }

      // fallback
      return bad('NOT_FOUND', 404);
    }

    return bad('METHOD_NOT_ALLOWED', 405);
  },
} satisfies ExportedHandler<Env>;
