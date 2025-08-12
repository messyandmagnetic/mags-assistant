export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname, searchParams } = url;
    const method = request.method;

    // helper to return JSON
    const json = (obj, status=200, headers={}) => new Response(JSON.stringify(obj), {status, headers: { 'content-type': 'application/json', ...headers }});

    // health check
    if (pathname === '/health' && method === 'GET') {
      return json({ ok: true });
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

    // queue endpoints
    if (pathname === '/api/queue/claim' && method === 'POST') {
      return json({ ok: true, task: null });
    }
    if (pathname === '/api/queue/ack' && method === 'POST') {
      return json({ ok: true });
    }

    // check panel
    if (pathname === '/check' && method === 'GET') {
      const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Maggie Check</title><style>body{font-family:sans-serif;padding:20px}button{margin:0.5rem}</style></head><body><h1>Maggie Check</h1><div><button id="ping">Ping Telegram</button><span id="pingRes"></span></div><div><button id="tally">Test Tally OK</button><span id="tallyRes"></span></div><div><button id="stripe">Test Stripe OK</button><span id="stripeRes"></span></div><div><button id="notion">Show Notion status</button><span id="notionRes"></span></div><p><a href="https://mags-assistant.vercel.app">Vercel Prod</a> | <a href="${env.WORKER_URL || ''}">Worker</a></p><script>
async function call(id, method, url, body, headers){const btn=document.getElementById(id),res=document.getElementById(id+'Res');res.textContent='…';try{const r=await fetch(url,{method,headers:{'content-type':'application/json',...(headers||{})},body:body?JSON.stringify(body):undefined});const j=await r.json();res.textContent=j.ok?'ok':'fail'}catch(e){res.textContent='error'}}
ping.onclick=()=>call('ping','POST','/api/telegram/send',{text:'ping'});
tally.onclick=()=>call('tally','POST','/api/tally/webhook',{check:true},{'tally-webhook-secret':'${env.TALLY_WEBHOOK_SECRET ? 'set' : ''}'});
stripe.onclick=()=>call('stripe','POST','/api/stripe/webhook',{});
notion.onclick=()=>call('notion','GET','/diag');
</script></body></html>`;
      return new Response(html, { headers: { 'content-type': 'text/html;charset=utf-8' } });
    }

    return new Response('Not found', { status: 404 });
  }
};
