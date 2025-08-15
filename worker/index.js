import { Client as NotionClient } from '@notionhq/client';
import { google } from 'googleapis';
import {
  ensureProfileDb,
  getProfileMap,
  getShareableProfile,
  buildExportPacket,
} from '../lib/profile.ts';
import { loadMemory, logLearning } from '../lib/memory.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    // --- CORS ---
    const cors = {
      'Access-Control-Allow-Origin': 'https://mags-assistant.vercel.app',
      'Access-Control-Allow-Headers': 'Content-Type, X-Fetch-Pass',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // auth gate for all routes when FETCH_PASS is set (unless DEV_MODE)
    const requirePass = env.FETCH_PASS && env.DEV_MODE !== 'true';
    const pass = request.headers.get('X-Fetch-Pass');
    if (requirePass && method !== 'OPTIONS' && pass !== env.FETCH_PASS) {
      return new Response(JSON.stringify({ ok: false, error: 'forbidden' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    // helper to return JSON
    const json = (obj, status = 200, headers = {}) =>
      new Response(JSON.stringify(obj), {
        status,
        headers: { ...cors, 'Content-Type': 'application/json', ...headers }
      });

    const callGemini = async (prompt) => {
      const key = env.GEMINI_API_KEY;
      if (!key) return { ok: false, error: 'MISSING_GEMINI_API_KEY' };
      try {
        const memory = loadMemory();
        const fullPrompt = `Maggie's memory:\n${JSON.stringify(memory)}\n\nUser prompt:\n${prompt}`;
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
            }),
          }
        );
        const data = await res.json();
        const text =
          data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        logLearning({ prompt, response: text });
        return { ok: true, text };
      } catch (e) {
        logLearning({ prompt, error: e.message });
        return { ok: false, error: 'GEMINI_ERROR' };
      }
    };

    // health check
    if (pathname === '/health' && method === 'GET') {
      return json({ ok: true, service: 'worker' });
    }

    // diag endpoint summarizing env availability
    if (pathname === '/diag' && method === 'GET') {
      const keys = ['NOTION_TOKEN','TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID','TALLY_WEBHOOK_SECRET','STRIPE_WEBHOOK_SECRET'];
      const summary = {};
      for (const k of keys) summary[`has_${k}`] = Boolean(env[k]);
      return json({ ok: true, env: summary });
    }

    // send message to telegram
    if (pathname === '/api/telegram/send' && method === 'POST') {
      const { text = '' } = await request.json();
      if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
        return json({ ok: false, error: 'missing telegram env' }, 500);
      }
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text })
      });
      return json({ ok: true });
    }

    // telegram webhook
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
      if (message.startsWith('ping')) {
        await reply('pong ✅');
      } else if (message.startsWith('post ')) {
        await reply(message.slice(5));
      }
      return json({ ok: true });
    }

    // tally webhook
    if ((pathname === '/tally/webhook' || pathname === '/api/tally/webhook') && method === 'POST') {
      const sig = request.headers.get('tally-webhook-secret') || request.headers.get('TALLY_WEBHOOK_SECRET');
      if (env.TALLY_WEBHOOK_SECRET && sig !== env.TALLY_WEBHOOK_SECRET) {
        return new Response('unauthorized', { status: 401 });
      }
      const body = await request.text();
      if (env.GAS_INTAKE_URL) {
        const headers = { 'content-type': 'application/json' };
        await fetch(env.GAS_INTAKE_URL, { method: 'POST', body, headers });
      }
      return json({ ok: true });
    }

    // stripe webhook
    if (pathname === '/api/stripe/webhook' && method === 'POST') {
      const signature = request.headers.get('stripe-signature');
      const payload = await request.text();
      if (env.STRIPE_WEBHOOK_SECRET) {
        try {
          const stripe = new (await import('stripe')).default(env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' });
          stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
        } catch (err) {
          return new Response('invalid signature', { status: 400 });
        }
      }
      console.log('stripe event size', payload.length);
      return json({ ok: true });
    }

    // stripe sync/audit stubs
    if (pathname === '/api/stripe/sync') {
      if (method === 'GET') {
        return json({ ok: true, action: 'sync', hint: 'POST to trigger' });
      }
      if (method === 'POST') {
        return json({ ok: true, action: 'sync', ts: Date.now() });
      }
    }
    if (pathname === '/api/stripe/audit') {
      if (method === 'GET') {
        return json({ ok: true, action: 'audit', hint: 'POST to trigger' });
      }
      if (method === 'POST') {
        return json({ ok: true, action: 'audit', ts: Date.now() });
      }
    }

    // queue endpoints
    if (pathname === '/api/queue/claim' && method === 'POST') {
      return json({ ok: true, task: null });
    }
    if (pathname === '/api/queue/ack' && method === 'POST') {
      return json({ ok: true });
    }
    
    // --- Gemini helpers ---
    if (pathname === '/ai/draft-reply' && method === 'POST') {
      const { thread } = await request.json().catch(() => ({}));
      const prompt = `Draft a friendly 100-150 word email reply.\n${JSON.stringify(thread || {})}`;
      const r = await callGemini(prompt);
      if (!r.ok) return json(r, 400);
      return json({ ok: true, text: r.text });
    }

    if (pathname === '/ai/summarize' && method === 'POST') {
      const { text = '' } = await request.json().catch(() => ({}));
      const prompt = `Summarize the following text into 3-5 bullet points.\n${text}`;
      const r = await callGemini(prompt);
      if (!r.ok) return json(r, 400);
      return json({ ok: true, text: r.text });
    }

    // --- Gmail land outreach scan ---
    if (pathname === '/land/scan' && method === 'POST') {
      const key =
        (env.GOOGLE_PRIVATE_KEY_P1 || '') +
        (env.GOOGLE_PRIVATE_KEY_P2 || '') +
        (env.GOOGLE_PRIVATE_KEY_P3 || '') +
        (env.GOOGLE_PRIVATE_KEY_P4 || '');
      if (!env.GOOGLE_CLIENT_EMAIL || !key) {
        return json({ ok: false, error: 'MISSING_GOOGLE_CREDS' }, 400);
      }
      try {
        const auth = new google.auth.JWT(env.GOOGLE_CLIENT_EMAIL, undefined, key.replace(/\\n/g, '\n'), [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.modify',
        ]);
        const gmail = google.gmail({ version: 'v1', auth });
        // ensure label
        const labelName = 'Land Outreach';
        const labels = await gmail.users.labels.list({ userId: 'me' });
        let label = labels.data.labels?.find((l) => l.name === labelName);
        if (!label) {
          const created = await gmail.users.labels.create({
            userId: 'me',
            requestBody: { name: labelName },
          });
          label = created.data;
        }
        const labelId = label.id;
        const terms = ['Laurie','Coyote','land','grant','donor','funding','financing','nonprofit'];
        const after = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10)
          .replace(/-/g, '/');
        const q = `(${terms.join(' OR ')}) after:${after}`;
        const list = await gmail.users.messages.list({ userId: 'me', q });
        const msgs = list.data.messages || [];
        const threadIds = [...new Set(msgs.map((m) => m.threadId))];
        let count = 0;
        for (const tid of threadIds) {
          await gmail.users.threads.modify({
            userId: 'me',
            id: tid,
            requestBody: { addLabelIds: [labelId] },
          });
          count++;
        }
        return json({ ok: true, count, label: labelName });
      } catch (e) {
        return json({ ok: false, error: 'GMAIL_ERROR' }, 500);
      }
    }

    // --- Gmail land outreach summary to Notion ---
    if (pathname === '/land/summary' && method === 'POST') {
      const key =
        (env.GOOGLE_PRIVATE_KEY_P1 || '') +
        (env.GOOGLE_PRIVATE_KEY_P2 || '') +
        (env.GOOGLE_PRIVATE_KEY_P3 || '') +
        (env.GOOGLE_PRIVATE_KEY_P4 || '');
      if (!env.GOOGLE_CLIENT_EMAIL || !key) {
        return json({ ok: false, error: 'MISSING_GOOGLE_CREDS' }, 400);
      }
      if (!env.NOTION_TOKEN || !env.NOTION_DATABASE_ID) {
        return json({ ok: false, error: 'MISSING_NOTION_CREDS' }, 400);
      }
      try {
        const auth = new google.auth.JWT(env.GOOGLE_CLIENT_EMAIL, undefined, key.replace(/\\n/g, '\n'), [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.modify',
        ]);
        const gmail = google.gmail({ version: 'v1', auth });
        const notion = new NotionClient({ auth: env.NOTION_TOKEN });
        const labelName = 'Land Outreach';
        const labels = await gmail.users.labels.list({ userId: 'me' });
        const label = labels.data.labels?.find((l) => l.name === labelName);
        if (!label) return json({ ok: true, upserts: 0 });
        const list = await gmail.users.threads.list({
          userId: 'me',
          labelIds: [label.id],
        });
        const threads = list.data.threads || [];
        let upserts = 0;
        const results = [];
        const parseFrom = (str = '') => {
          const m = str.match(/^(.*)<(.+)>/);
          return m ? [m[1].trim(), m[2].trim()] : [str, str];
        };
        for (const t of threads) {
          const thr = await gmail.users.threads.get({ userId: 'me', id: t.id });
          const messages = thr.data.messages || [];
          if (messages.length < 2) continue;
          const first = messages[0];
          const headers = first.payload?.headers || [];
          const fromH = headers.find((h) => h.name === 'From')?.value || '';
          const [fromName, fromEmail] = parseFrom(fromH);
          const snippet = thr.data.snippet || '';
          const threadUrl = `https://mail.google.com/mail/u/0/#all/${t.id}`;
          let suggestedReply = 'Thanks for reaching out about Coyote Commons.';
          const g = env.GEMINI_API_KEY
            ? await callGemini(
                `Draft a short reply to: ${snippet}`
              )
            : { ok: false };
          if (g.ok) suggestedReply = g.text;
          results.push({
            from: fromEmail || fromName,
            date: new Date(parseInt(first.internalDate || '0')).toISOString(),
            snippet,
            intent: 'general',
            suggestedReply,
          });
          // upsert into notion
          const existing = await notion.databases.query({
            database_id: env.NOTION_DATABASE_ID,
            filter: { property: 'Thread URL', url: { equals: threadUrl } },
          });
          if (existing.results[0]) {
            await notion.pages.update({
              page_id: existing.results[0].id,
              properties: {
                Summary: { rich_text: [{ text: { content: snippet } }] },
                'Suggested Reply': {
                  rich_text: [{ text: { content: suggestedReply } }],
                },
              },
            });
          } else {
            await notion.pages.create({
              parent: { database_id: env.NOTION_DATABASE_ID },
              properties: {
                Contact: { title: [{ text: { content: fromName || fromEmail } }] },
                Type: { select: { name: 'Other' } },
                Email: { email: fromEmail || '' },
                'Thread URL': { url: threadUrl },
                Summary: { rich_text: [{ text: { content: snippet } }] },
                'Suggested Reply': {
                  rich_text: [{ text: { content: suggestedReply } }],
                },
                Status: { select: { name: 'New' } },
              },
            });
          }
          upserts++;
        }
        return json({ ok: true, upserts, threads: results });
      } catch (e) {
        return json({ ok: false, error: 'GMAIL_NOTION_ERROR' }, 500);
      }
    }

    // --- Daily ops digest ---
    if (pathname === '/ops/digest' && method === 'POST') {
      if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
        return json({ ok: false, error: 'MISSING_TELEGRAM' }, 400);
      }
      try {
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: 'Digest ready.' }),
        });
        return json({ ok: true });
      } catch (e) {
        return json({ ok: false, error: 'TELEGRAM_ERROR' }, 500);
      }
    }

    if (pathname === '/profile/share' && method === 'GET') {
      if (requirePass && pass !== env.FETCH_PASS)
        return json({ ok: false, error: 'forbidden' }, 401);
      const dbId = env.PROFILE_DB_ID || (await ensureProfileDb(env));
      if (!dbId) return json({ ok: true, data: {}, count: 0 });
      const data = await getShareableProfile({ ...env, PROFILE_DB_ID: dbId });
      return json({ ok: true, data, count: Object.keys(data).length });
    }

    if (pathname === '/profile/export' && method === 'GET') {
      if (requirePass && pass !== env.FETCH_PASS)
        return json({ ok: false, error: 'forbidden' }, 401);
      const includePII = url.searchParams.get('includePII') === 'true';
      const dbId = env.PROFILE_DB_ID || (await ensureProfileDb(env));
      const map = dbId
        ? await getProfileMap({ ...env, PROFILE_DB_ID: dbId })
        : {};
      const exportMap = {};
      for (const [k, v] of Object.entries(map)) {
        if (v.visibility === 'shareable') exportMap[k] = v.value;
      }
      exportMap.founder_name = map.founder_name?.value || '';
      exportMap.founder_email = map.founder_email?.value || '';
      const packet = buildExportPacket(exportMap, { includePII });
      return new Response(JSON.stringify(packet), {
        status: 200,
        headers: {
          ...cors,
          'Content-Type': 'application/json',
          'Content-Disposition':
            'attachment; filename="coyote_profile_export.json"',
        },
      });
    }

    // check panel
    if (pathname === '/check' && method === 'GET') {
      const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Maggie Check</title><style>body{font-family:sans-serif;padding:20px}button{margin:0.5rem}</style></head><body><h1>Maggie Check</h1><div><button id="ping">Ping Telegram</button><span id="pingRes"></span></div><div><button id="tally">Test Tally OK</button><span id="tallyRes"></span></div><div><button id="stripe">Test Stripe OK</button><span id="stripeRes"></span></div><div><button id="notion">Show Notion status</button><span id="notionRes"></span></div><div id="profileTile"><button id="share">Shareable Profile</button><span id="shareRes"></span><button id="exportBtn">Download Export JSON</button></div><p><a href="https://mags-assistant.vercel.app">Vercel Prod</a> | <a href="${env.WORKER_URL || ''}">Worker</a></p><script>
async function call(id, method, url, body, headers){const btn=document.getElementById(id),res=document.getElementById(id+'Res');res.textContent='…';try{const r=await fetch(url,{method,headers:{'content-type':'application/json',...(headers||{})},body:body?JSON.stringify(body):undefined});const j=await r.json();res.textContent=j.ok?'ok':'fail'}catch(e){res.textContent='error'}}
ping.onclick=()=>call('ping','POST','/api/telegram/send',{text:'ping'});
tally.onclick=()=>call('tally','POST','/api/tally/webhook',{check:true},{'tally-webhook-secret':'${env.TALLY_WEBHOOK_SECRET ? 'set' : ''}'});
stripe.onclick=()=>call('stripe','POST','/api/stripe/webhook',{});
notion.onclick=()=>call('notion','GET','/diag');
share.onclick=async()=>{const tile=document.getElementById('profileTile');tile.style.background='';shareRes.textContent='…';try{const r=await fetch('/profile/share');const j=await r.json();if(j.ok){shareRes.textContent=j.count;if(j.count>=5)tile.style.background='lightgreen';else if(j.count>0)tile.style.background='khaki';}else{shareRes.textContent='fail';tile.style.background='lightcoral';}}catch{shareRes.textContent='error';tile.style.background='lightcoral';}};
exportBtn.onclick=()=>{window.open('/profile/export','_blank');};
</script></body></html>`;
      return new Response(html, { headers: { 'content-type': 'text/html;charset=utf-8' } });
    }

    return new Response('Not found', { status: 404 });
  }
};
