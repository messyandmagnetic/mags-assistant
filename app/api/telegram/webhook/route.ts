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
    const msg = update.message ?? update.edited_message;
    const chatId = String(msg?.chat?.id ?? '');
    const text: string = msg?.text ?? '';

    if (!text || !allowed || chatId !== String(allowed)) {
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
