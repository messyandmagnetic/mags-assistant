import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { text = '', html } = await req.json();
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChat = process.env.TELEGRAM_CHAT_ID;
    const resendKey = process.env.RESEND_API_KEY;
    const notifyEmail = process.env.NOTIFY_EMAIL;

    const tasks: Promise<any>[] = [];
    const plain = text || (html ? html.replace(/<[^>]+>/g, '').slice(0, 4000) : '');

    if (tgToken && tgChat) {
      tasks.push(fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgChat, text: plain })
      }));
    }

    if (resendKey && notifyEmail) {
      tasks.push(fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendKey}`
        },
        body: JSON.stringify({
          from: 'Mags <mags@messyandmagnetic.com>',
          to: [notifyEmail],
          subject: 'Mags Notification',
          html: html ?? `<pre>${plain}</pre>`
        })
      }));
    }

    await Promise.all(tasks);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'notify-failed' }, { status: 500 });
  }
}
