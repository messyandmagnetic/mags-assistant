import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_: VercelRequest, res: VercelResponse) {
  const base = 'https://tight-snow-2840.messyandmagnetic.workers.dev';
  res.status(200).json({
    digest: `${base}/digest`,
    statusPacket: `${base}/status-packet`,
    landScan: `${base}/land/scan`,
    landSummary: `${base}/land/summary`,
  });
}
