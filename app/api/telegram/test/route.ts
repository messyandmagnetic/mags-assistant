import { tgSend } from '../../../../lib/telegram';

export const runtime = 'nodejs';

export async function GET() {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    return Response.json({ ok:false, missing:["TELEGRAM_BOT_TOKEN","TELEGRAM_CHAT_ID"] });
  }
  const msg = `✅ Telegram test @ ${new Date().toISOString()}`;
  const out = await tgSend(msg);
  return Response.json(out);
}
