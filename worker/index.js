import { Client as NotionClient } from '@notionhq/client';
import { sendEmail } from '../lib/gmail.ts';
import {
  ensureProfileDb,
  getProfileMap,
  getShareableProfile,
  buildExportPacket,
} from '../lib/profile.ts';

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

    // auth gate only for POST if FETCH_PASS is set
    const requirePass = !!env.FETCH_PASS;
    const pass = request.headers.get('X-Fetch-Pass');
    if (requirePass && method === 'POST' && pass !== env.FETCH_PASS) {
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
    if (pathname === '/api/tally/webhook' && method === 'POST') {
      const sig = request.headers.get('tally-webhook-secret') || request.headers.get('TALLY_WEBHOOK_SECRET');
      if (env.TALLY_WEBHOOK_SECRET && sig !== env.TALLY_WEBHOOK_SECRET) {
        return new Response('unauthorized', { status: 401 });
      }
      const body = await request.json();
      console.log('tally webhook', body);
      return json({ ok: true });
    }

    // stripe webhook
    if (pathname === '/api/stripe/webhook') {
      if (method !== 'POST') {
        return json({ ok: false, error: 'method not allowed' }, 405);
      }
      const secret = env.STRIPE_WEBHOOK_SECRET;
      if (!secret) {
        return json({ ok: false, error: 'missing env' }, 500);
      }
      const sigHeader = request.headers.get('stripe-signature');
      if (!sigHeader) {
        return json({ ok: false, error: 'missing stripe-signature' }, 400);
      }
      const payload = await request.text();
      const parts = sigHeader.split(',').reduce((acc, p) => {
        const [k, v] = p.split('=');
        acc[k] = v;
        return acc;
      }, {});
      const timestamp = parts.t;
      const signature = parts.v1;
      if (!timestamp || !signature) {
        return json({ ok: false, error: 'invalid signature header' }, 400);
      }
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const data = encoder.encode(`${timestamp}.${payload}`);
      const mac = await crypto.subtle.sign('HMAC', key, data);
      const expected = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('');
      let valid = signature.length === expected.length;
      if (valid) {
        let diff = 0;
        for (let i = 0; i < expected.length; i++) {
          diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
        }
        valid = diff === 0;
      }
      if (!valid) {
        return json({ ok: false, error: 'invalid signature' }, 400);
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

    const templates = {
      financing: `Hello [Name],\nThank you for your willingness to help us secure the Coyote Commons property. We’re pursuing a short-term bridge while philanthropic funds clear. I’m most comfortable handling details by email—could you share the ballpark terms you’d consider (amount, term, interest, collateral)? I’ll reply quickly with any materials you need.\nWarmly,\n[Your Name]`,
      'donor/grant': `Hi [Name],\nThank you for your interest in Coyote Commons—a regenerative land + community hub. Our donation link is ready for immediate gifts that secure the land. I prefer email, so if you have questions, feel free to reply here and I’ll send the one-page brief and receipt details.\nWith gratitude,\n[Your Name]`,
      'realtor/seller': `Hi [Name],\nWe’re advancing financing on parallel tracks (bridge + philanthropic) and moving quickly. I prefer email—could you share any timeline updates or active offers so we can align our written offer?\nBest,\n[Your Name]`,
      'general-info': `Hi [Name],\nHappy to continue via email and provide any details you need about Coyote Commons. Phone if necessary.\nBest,\n[Your Name]`
    };

    if (pathname === '/land/summary' && method === 'POST') {
      const body = await request.json();
      const threads = body?.threads || [];
      let sent = 0;
      const notion = env.NOTION_TOKEN && env.OUTREACH_DB_ID ? new NotionClient({ auth: env.NOTION_TOKEN }) : null;
      const shouldSend = env.SEND_AUTOREPLY === true || env.SEND_AUTOREPLY === 'true';
      for (const t of threads) {
        const tpl = templates[t.intent];
        if (!tpl || !shouldSend || !t.email) continue;
        const text = tpl.replace('[Name]', t.name || 'there').replace('[Your Name]', env.OUTREACH_NAME || 'Maggie');
        try {
          await sendEmail({ to: t.email, subject: t.subject || 'Re: Coyote Commons', text });
          sent++;
          if (notion && t.id) {
            await notion.pages.update({
              page_id: t.id,
              properties: {
                Status: { select: { name: 'Replied' } },
                Summary: {
                  rich_text: [
                    {
                      text: { content: `Auto-reply sent @ ${new Date().toISOString().slice(0, 10)}` },
                    },
                  ],
                },
              },
            });
          }
        } catch (e) {
          console.warn('sendEmail failed', e);
        }
      }
      return json({ ok: true, sent });
    }

    if (pathname === '/land/mark' && method === 'POST') {
      const { id, threadUrl, status } = await request.json();
      if (!env.NOTION_TOKEN || !env.OUTREACH_DB_ID) {
        return json({ ok: false, error: 'missing env' }, 500);
      }
      const notion = new NotionClient({ auth: env.NOTION_TOKEN });
      let pageId = id;
      if (!pageId && threadUrl) {
        const res = await notion.databases.query({
          database_id: env.OUTREACH_DB_ID,
          filter: { property: 'Thread URL', url: { equals: threadUrl } },
        });
        pageId = res.results[0]?.id;
      }
      if (!pageId) return json({ ok: false, error: 'not found' }, 404);
      await notion.pages.update({
        page_id: pageId,
        properties: { Status: { select: { name: status } } },
      });
      return json({ ok: true });
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
