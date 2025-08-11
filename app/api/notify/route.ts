import { NextRequest } from 'next/server';

async function sendEmail(title: string, message: string, links?: any[]) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  if (!key || !to) return;
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
      text: `${message}\n${links?.map((l) => l).join('\n') || ''}`,
    }),
  });
}

async function sendWebhook(title: string, message: string, links?: any[]) {
  const url = process.env.NOTIFY_WEBHOOK;
  if (!url) return;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, message, links }),
  });
}

export async function POST(req: NextRequest) {
  const { level = 'info', title, message, links } = await req.json();
  await Promise.all([
    sendEmail(title, message, links),
    sendWebhook(title, message, links),
  ]);
  return new Response(JSON.stringify({ ok: true, level }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
