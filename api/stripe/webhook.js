import Stripe from 'stripe';
import { env } from '../../lib/env.js';

export default async function(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const sig = req.headers['stripe-signature'];
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(400).json({ ok: false, reason: 'no STRIPE_WEBHOOK_SECRET' });
  const stripe = new Stripe(env.STRIPE_SECRET_KEY || '');
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, secret);
  } catch (e) {
    return res.status(400).json({ ok: false, reason: e.message });
  }
  switch (event.type) {
    case 'checkout.session.completed':
    case 'payment_intent.succeeded':
      console.log('stripe event', event.type);
      break;
    default:
      break;
  }
  res.json({ ok: true });
}
