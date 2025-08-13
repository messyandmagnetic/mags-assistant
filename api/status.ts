import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    service: "mags-assistant",
    env: process.env.VERCEL_ENV || "unknown",
    node: process.version,
  });
}
