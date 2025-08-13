export async function tgSend(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return { ok: false, reason: "MISSING_TELEGRAM_ENV" };
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = { chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true };
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, resp: j };
}
