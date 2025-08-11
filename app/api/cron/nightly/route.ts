import { NextResponse } from 'next/server';
import { notify } from '../../../../lib/tools';

export async function POST() {
  await notify({ level: 'info', title: 'Daily summary', message: 'TODO' });
  return NextResponse.json({ ok: true });
}
