import { NextRequest } from 'next/server';

export const runtime = 'nodejs18.x';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return Response.json(body);
}
