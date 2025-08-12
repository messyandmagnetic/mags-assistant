export default async function(req, res) {
  const next_steps = [];
  const url = process.env.GMAIL_BRIDGE_URL;
  const secret = process.env.APPS_SCRIPT_SECRET;
  if (!url || !secret) {
    if (!url) next_steps.push('Set GMAIL_BRIDGE_URL');
    if (!secret) next_steps.push('Set APPS_SCRIPT_SECRET');
    return res.json({ ok: false, reason: 'missing bridge config', next_steps });
  }
  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/ping`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const j = await r.json().catch(() => ({}));
    return res.json({ ok: r.ok && j.ok });
  } catch (e) {
    return res.json({ ok: false, reason: e.message, next_steps });
  }
}
