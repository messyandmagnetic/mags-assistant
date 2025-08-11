import Stripe from 'stripe';
import { NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2022-11-15',
});

export async function GET() {
  try {
    const products = await stripe.products.list({
      active: true,
      expand: ['data.default_price'],
    });
    const data = products.data.map((p) => ({
      id: p.id,
      name: p.name,
      price:
        typeof p.default_price === 'object' && p.default_price
          ? (p.default_price.unit_amount || 0) / 100
          : 0,
      image: p.images && p.images.length > 0 ? p.images[0] : null,
    }));
    return NextResponse.json({ products: data });
  } catch (e) {
    return NextResponse.json({ products: [] }, { status: 500 });
  }
}
