import { NextRequest, NextResponse } from 'next/server';

async function sendTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const chat = process.env.TELEGRAM_CHAT_ID!;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();
    const allowed = process.env.TELEGRAM_CHAT_ID;

    if (update.callback_query) {
      const chatId = String(update.callback_query.message?.chat?.id ?? '');
      if (allowed && chatId === String(allowed)) {
        try {
          const data = JSON.parse(update.callback_query.data || '{}');
          await fetch(`${process.env.API_BASE ?? ''}/api/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
        } catch {}
      }
      try {
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: update.callback_query.id }),
        });
      } catch {}
      return NextResponse.json({ ok: true });
    }

    const msg = update.message ?? update.edited_message;
    const chatId = String(msg?.chat?.id ?? '');
    const text: string = msg?.text ?? '';

    if (!text || !allowed || chatId !== String(allowed)) {
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith('/')) {
      const [cmd, ...args] = text.split(' ');
      const base = process.env.API_BASE ?? '';
      switch (cmd) {
        case '/status':
          try {
            const r = await fetch(`${base}/api/status`);
            const body = await r.text();
            await sendTelegram(body || 'System online.');
          } catch {
            await sendTelegram('Status check failed.');
          }
          break;
        case '/gen':
          if (args[0] === 'filler') {
            await fetch(`${base}/api/gen/filler`, { method: 'POST' }).catch(() => {});
            await sendTelegram('Generating filler content.');
          } else {
            await sendTelegram('Unknown /gen command');
          }
          break;
        case '/post':
          if (args[0] === 'now') {
            await fetch(`${base}/api/post/now`, { method: 'POST' }).catch(() => {});
            await sendTelegram('Posting queued clip.');
          } else {
            await sendTelegram('Unknown /post command');
          }
          break;
        case '/clip':
          if (args[0] === 'last') {
            await fetch(`${base}/api/clip/last`, { method: 'POST' }).catch(() => {});
            await sendTelegram('Clipping last video.');
          } else {
            await sendTelegram('Unknown /clip command');
          }
          break;
        case '/queue':
          await sendTelegram('Queue is empty.');
          break;
        case '/approve':
          await sendTelegram(`Approved ${args.join(' ')}`);
          break;
        case '/rework':
          await sendTelegram(`Rework ${args[0] ?? ''}`);
          break;
        case '/report':
          await sendTelegram('No report available.');
          break;
        case '/link':
          const scopes = [
            `Buffer: ${process.env.BUFFER_ACCESS_TOKEN ? 'on' : 'missing BUFFER_ACCESS_TOKEN'}`,
            `Notion: ${process.env.NOTION_TOKEN ? 'on' : 'missing NOTION_TOKEN'}`,
          ];
          await sendTelegram(scopes.join('\n'));
          break;
        default:
          await sendTelegram('Unknown command');
      }
      return NextResponse.json({ ok: true });
    }

    const res = await fetch(`${process.env.API_BASE ?? ''}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: text }] })
    });
    const reply = await res.text();

    await sendTelegram(reply || 'Okay!');
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: true });
  }
}
