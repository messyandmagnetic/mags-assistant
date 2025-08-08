import { NextResponse } from 'next/server';

const ENDPOINT = `https://production-sfo.browserless.io/sessions?token=${process.env.BROWSERLESS_API_KEY}`;

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');
    const ttl = searchParams.get('ttl');
    const payload = { url, ttl };
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: data.error || 'Failed to start session' }, { status: res.status });
    }
    return NextResponse.json({ ok: true, viewerUrl: data.url });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
