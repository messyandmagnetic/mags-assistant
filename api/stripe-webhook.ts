import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import getRawBody from 'raw-body';

export const config = { runtime: 'nodejs' };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });
const secret = process.env.STRIPE_WEBHOOK_SECRET!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const sig = req.headers['stripe-signature'] as string;
    const raw = (await getRawBody(req)).toString('utf8');
    const event = stripe.webhooks.constructEvent(raw, sig, secret);

    // OPTIONAL: forward to Worker for real processing
    // await fetch('https://tight-snow-2840.messyandmagnetic.workers.dev/stripe/ingest', {
    //   method: 'POST',
    //   headers: { 'content-type': 'application/json', 'X-Fetch-Pass': process.env.FETCH_PASS ?? '' },
    //   body: JSON.stringify({ type: event.type, data: event.data })
    // });

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ ok: false, error: e.message ?? 'invalid payload' });
  }
}
