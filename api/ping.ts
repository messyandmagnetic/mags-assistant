import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { runtime: 'nodejs' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: true, ts: Date.now(), env: 'vercel' });
}
