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
    await stripe.prices.list({ limit: 1 });
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, reason: e.message, next_steps });
  }
}
