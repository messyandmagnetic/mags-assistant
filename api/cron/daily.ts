import type { VercelRequest, VercelResponse } from "@vercel/node";
export const config = { runtime: "nodejs" };
export default async function handler(_: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: true, cron: "daily", ranAt: new Date().toISOString() });
}
