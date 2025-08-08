import { NextResponse } from 'next/server';

const VARS = [
  'OPENAI_API_KEY',
  'BROWSERLESS_API_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'STRIPE_SECRET_KEY',
];

export async function GET() {
  const present = VARS.filter((v) => !!process.env[v]);
  return NextResponse.json({ env: present });
}
