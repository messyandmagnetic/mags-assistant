export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const base =
    process.env.BROWSERLESS_BASE || 'https://production-sfo.browserless.io';
  const haveKey = Boolean(
    process.env.BROWSERLESS_TOKEN ||
      process.env.BROWSERLESS_API_KEY ||
      process.env.BROWSERLESS_KEY
  );

  res.status(200).json({ ok: true, base, haveKey });
}

export const config = { runtime: 'nodejs20.x' };
