import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, sendTelegram } from '../notify/route';

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_BOT_SECRET;
  if (secret && req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const update = await req.json();
  const cb = update.callback_query;
  if (cb?.data?.startsWith('approve:')) {
    const id = cb.data.split(':')[1];
    try {
      await fetch(`${process.env.API_BASE ?? ''}/api/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.CHAT_PASSWORD ?? ''}`,
        },
        body: JSON.stringify({ id, action: 'approve' }),
      });
      await Promise.all([
        sendTelegram('Approved', `Action ${id} completed`, []),
        sendEmail('Approved', `Action ${id} completed`, []),
      ]);
    } catch {}
  }
  return NextResponse.json({ ok: true });
}
