import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!secret || !stripeKey) {
    return new NextResponse('missing env', { status: 500 });
  }
  const payload = await req.text();
  const sig = req.headers.get('stripe-signature') || '';
  try {
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
    stripe.webhooks.constructEvent(payload, sig, secret);
  } catch {
    return new NextResponse('invalid signature', { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
