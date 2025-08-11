import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { name, email, message } = await req.json();
    const text = `New contact form submission:\nName: ${name}\nEmail: ${email}\nMessage:\n${message}`;

    if (process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'onboarding@resend.dev',
          to: process.env.NOTIFY_EMAIL,
          subject: 'New contact form submission',
          text,
        }),
      });
    } else {
      await fetch('https://assistant.messyandmagnetic.com/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
    }

    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: process.env.TELEGRAM_CHAT_ID,
            text,
          }),
        },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return new NextResponse('Error', { status: 500 });
  }
}
