import { NextRequest, NextResponse } from 'next/server';

export async function sendEmail(title: string, message: string, links: string[]) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  if (!key || !to) return;
  const body = `${message}${links.length ? '\n' + links.join('\n') : ''}`;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      from: 'Mags <noreply@messyandmagnetic.com>',
      to: [to],
      subject: title,
      text: body,
    }),
  });
}

export async function sendTelegram(
  title: string,
  message: string,
  links: string[],
  buttons?: { text: string; url?: string; cb?: string }[],
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  const text = `*${title}*\n${message}${links.length ? '\n' + links.join('\n') : ''}`;
  const payload: any = { chat_id: chat, text, parse_mode: 'Markdown' };
  if (buttons && buttons.length) {
    payload.reply_markup = {
      inline_keyboard: [
        buttons.map((b) => ({ text: b.text, url: b.url, callback_data: b.cb })),
      ],
    };
  }
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

let latestLevel: 'info' | 'warn' | 'error' = 'info';

export async function GET() {
  return NextResponse.json({ level: latestLevel });
}

export async function POST(req: NextRequest) {
  const { level = 'info', title = '', message = '', links = [], approveId } =
    await req.json();
  latestLevel = level;
  const buttons: { text: string; url?: string; cb?: string }[] = [];
  if (approveId) buttons.push({ text: 'Approve', cb: `approve:${approveId}` });
  if (links[0]) buttons.push({ text: 'View', url: links[0] });
  await Promise.all([
    sendTelegram(title, message, links, buttons),
    sendEmail(title, message, links),
    (async () => {
      if (process.env.NOTIFY_WEBHOOK) {
        try {
          await fetch(process.env.NOTIFY_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ level, title, message, links, approveId }),
          });
        } catch {}
      }
    })(),
  ]);
  return NextResponse.json({ ok: true });
}
