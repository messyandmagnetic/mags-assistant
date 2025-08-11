import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const password = process.env.CHAT_PASSWORD;
  if (!password || auth !== `Bearer ${password}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const { id, action } = await req.json();
  // TODO: perform queued action
  return NextResponse.json({ ok: true, id, action });
}
