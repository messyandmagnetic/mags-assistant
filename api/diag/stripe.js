import { env } from '../../lib/env.js';
import Stripe from 'stripe';

export default async function(req, res) {
  const next_steps = [];
  if (!env.STRIPE_SECRET_KEY) {
    next_steps.push('Set STRIPE_SECRET_KEY');
    return res.json({ ok: false, reason: 'missing STRIPE_SECRET_KEY', next_steps });
  }
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  try {
    await stripe.balance.retrieve();
    await stripe.products.list({ limit: 1 });
  } catch (e) {
    return res.json({ ok: false, reason: e.message, next_steps });
  }
  const webhookSet = !!env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSet) next_steps.push('Set STRIPE_WEBHOOK_SECRET');
  res.json({ ok: true, webhook: webhookSet, next_steps });
}
