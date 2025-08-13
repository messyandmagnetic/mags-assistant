import type { VercelRequest, VercelResponse } from "@vercel/node";

const w = (n?: any) => (typeof n === "number" ? n : undefined);

export const config = { runtime: "nodejs" };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const PUBLIC = {
    NEXT_PUBLIC_FETCH_PASS: process.env.NEXT_PUBLIC_FETCH_PASS ? true : false,
  };
  const SECRET = {
    FETCH_PASS: !!process.env.FETCH_PASS,
    STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
    NOTION_TOKEN: !!process.env.NOTION_TOKEN,
    TELEGRAM_BOT_TOKEN: !!process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: !!process.env.TELEGRAM_CHAT_ID,
    GOOGLE_CLIENT_EMAIL: !!process.env.GOOGLE_CLIENT_EMAIL,
    GOOGLE_PRIVATE_KEY_P1: !!process.env.GOOGLE_PRIVATE_KEY_P1,
    GOOGLE_PRIVATE_KEY_P2: !!process.env.GOOGLE_PRIVATE_KEY_P2,
    GOOGLE_PRIVATE_KEY_P3: !!process.env.GOOGLE_PRIVATE_KEY_P3,
    GOOGLE_PRIVATE_KEY_P4: !!process.env.GOOGLE_PRIVATE_KEY_P4
  };

  // Optional: probe Cloudflare Worker health and land routes if we have FETCH_PASS
  const workerBase = process.env.WORKER_BASE_URL || ""; // e.g. https://tight-snow-2840.messyandmagnetic.workers.dev
  const pass = process.env.NEXT_PUBLIC_FETCH_PASS || process.env.FETCH_PASS || "";

  async function probe(path: string, method = "GET") {
    if (!workerBase) return { ok: false, skip: true, reason: "no WORKER_BASE_URL" };
    try {
      const r = await fetch(`${workerBase}${path}`, {
        method,
        headers: pass ? { "X-Fetch-Pass": pass } : {}
      });
      const txt = await r.text();
      return { ok: r.ok, status: r.status, len: w(txt?.length) };
    } catch (e:any) {
      return { ok: false, error: String(e?.message || e) };
    }
  }

  const matrix = {
    vercel: { ok: true },
    env: { public: PUBLIC, secret: SECRET },
    worker: {
      health: await probe("/health", "GET"),
      landScan: await probe("/land/scan", "POST"),
      landSummary: await probe("/land/summary", "POST"),
    }
  };

  res.status(200).json({ ok: true, matrix, at: new Date().toISOString() });
}
