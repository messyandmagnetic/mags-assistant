import { env } from '../../lib/env.js';

export default async function(req, res) {
  const secret = env.CRON_SECRET;
  const next_steps = [];
  if (!secret) {
    next_steps.push('Set CRON_SECRET');
    return res.json({ ok: false, reason: 'missing CRON_SECRET', next_steps });
  }
  const base = process.env.API_BASE || '';
  const mk = (p) => `${base}/api/cron/${p}?secret=${secret}`;
  res.json({
    ok: true,
    urls: {
      daily: mk('daily'),
      'stripe-poll': mk('stripe-poll'),
      'gmail-scan': mk('gmail-scan'),
    },
  });
}
