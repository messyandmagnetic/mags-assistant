import fs from 'fs/promises';
import { getSecret, guard } from '../utils/safe-env';

type Check = { name: string; status: 'ok' | 'skipped' | 'error'; details?: string };

(async () => {
  const cfg = JSON.parse(await fs.readFile('public/mags-config.json', 'utf8'));
  void cfg; // config is read for completeness

  const checks: Check[] = [];
  const advice: string[] = [];

  const skip = (name: string, missing: string) => {
    checks.push({ name, status: 'skipped', details: 'no secrets' });
    advice.push(`set ${missing}`);
  };

  // OpenAI
  const openai = getSecret('OPENAI_API_KEY');
  if (!openai.present) {
    skip('openai', 'OPENAI_API_KEY');
  } else {
    const r = await guard('openai', async () => {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${openai.value}` },
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      return true;
    });
    checks.push(
      r.ok ? { name: 'openai', status: 'ok' } : { name: 'openai', status: 'error', details: r.error }
    );
  }

  // Notion
  const notion = getSecret('NOTION_TOKEN');
  if (!notion.present) {
    skip('notion', 'NOTION_TOKEN');
  } else {
    const r = await guard('notion', async () => {
      const res = await fetch('https://api.notion.com/v1/users/me', {
        headers: {
          Authorization: `Bearer ${notion.value}`,
          'Notion-Version': '2022-06-28',
        },
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      return true;
    });
    checks.push(
      r.ok ? { name: 'notion', status: 'ok' } : { name: 'notion', status: 'error', details: r.error }
    );
  }

  // Stripe
  const stripe = getSecret('STRIPE_SECRET_KEY');
  if (!stripe.present) {
    skip('stripe', 'STRIPE_SECRET_KEY');
  } else {
    const r = await guard('stripe', async () => {
      const res = await fetch('https://api.stripe.com/v1/balance', {
        headers: { Authorization: `Bearer ${stripe.value}` },
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      return true;
    });
    checks.push(
      r.ok ? { name: 'stripe', status: 'ok' } : { name: 'stripe', status: 'error', details: r.error }
    );
  }

  // Telegram
  const tgToken = getSecret('TELEGRAM_BOT_TOKEN');
  const tgChat = getSecret('TELEGRAM_CHAT_ID');
  if (!tgToken.present || !tgChat.present) {
    skip('telegram', 'TELEGRAM_BOT_TOKEN & TELEGRAM_CHAT_ID');
  } else {
    const r = await guard('telegram', async () => {
      const res = await fetch(`https://api.telegram.org/bot${tgToken.value}/getMe`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      return true;
    });
    checks.push(
      r.ok ? { name: 'telegram', status: 'ok' } : { name: 'telegram', status: 'error', details: r.error }
    );
  }

  // API / Prod URL
  const prod = getSecret('PROD_URL');
  const apiBase = getSecret('API_BASE');
  const base = prod.present ? prod.value : apiBase.present ? apiBase.value : undefined;
  if (!base) {
    skip('api', 'PROD_URL or API_BASE');
  } else {
    const r = await guard('api', async () => {
      const res = await fetch(base);
      if (!res.ok) throw new Error(`status ${res.status}`);
      return true;
    });
    checks.push(
      r.ok ? { name: 'api', status: 'ok' } : { name: 'api', status: 'error', details: r.error }
    );
  }

  // Worker
  const worker = getSecret('WORKER_URL');
  if (!worker.present) {
    skip('worker', 'WORKER_URL');
  } else {
    const r = await guard('worker', async () => {
      const url = worker.value!.replace(/\/$/, '') + '/health';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`status ${res.status}`);
      return true;
    });
    checks.push(
      r.ok ? { name: 'worker', status: 'ok' } : { name: 'worker', status: 'error', details: r.error }
    );
  }

  const out: any = { timeISO: new Date().toISOString(), checks };
  if (advice.length) out.advice = advice;
  console.log(JSON.stringify(out, null, 2));
})();
