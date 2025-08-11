import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action = '', kind, targetId, actionId, previewUrl } = body;
    console.log('approve webhook', body);

    // TODO: wire into workers for real execution
    if (action === 'approve') {
      // placeholder: acknowledge approval
      await fetch(`${process.env.API_BASE ?? ''}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `Approved ${kind || 'item'} ${targetId || ''}` }),
      });
    }
    if (action === 'decline') {
      await fetch(`${process.env.API_BASE ?? ''}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `Declined ${kind || 'item'} ${targetId || ''}` }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'approve-failed' }, { status: 500 });
  }
}
