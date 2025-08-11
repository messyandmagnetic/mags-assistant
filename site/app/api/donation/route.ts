import Stripe from 'stripe';
import { NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2022-11-15',
});

export async function GET() {
  try {
    const prices = await stripe.prices.list({ lookup_keys: ['donation'], limit: 1 });
    const price = prices.data[0];
    if (!price) {
      return NextResponse.json({ url: null });
    }
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: `${baseUrl}/donate?success=true`,
      cancel_url: `${baseUrl}/donate?canceled=true`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json({ url: null }, { status: 500 });
  }
}
