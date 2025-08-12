export default async function(req, res) {
  const url = process.env.GMAIL_BRIDGE_URL;
  const secret = process.env.APPS_SCRIPT_SECRET;
  const next_steps = [];
  if (!url || !secret) {
    if (!url) next_steps.push('Set GMAIL_BRIDGE_URL');
    if (!secret) next_steps.push('Set APPS_SCRIPT_SECRET');
    return res.json({ ok: false, reason: 'missing bridge config', next_steps });
  }
  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/nudge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(req.body || {}),
    });
    const data = await r.json().catch(() => ({}));
    res.json({ ok: r.ok, data });
  } catch (e) {
    res.json({ ok: false, reason: e.message, next_steps });
  }
}
