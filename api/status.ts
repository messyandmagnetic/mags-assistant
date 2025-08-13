import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_: VercelRequest, res: VercelResponse) {
  const out = {
    vercel: { ok: false },
    worker: { ok: false },
    ts: new Date().toISOString(),
  } as any;

  try {
    const r = await fetch('https://mags-assistant.vercel.app/api/ping');
    out.vercel.ok = r.ok;
  } catch (_) {}

  try {
    const r = await fetch('https://tight-snow-2840.messyandmagnetic.workers.dev/health');
    out.worker.ok = r.ok;
  } catch (_) {}

  res.status(200).json(out);
}
