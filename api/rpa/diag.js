export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  const token = process.env.BROWSERLESS_API_KEY || process.env.BROWSERLESS_TOKEN;
  res.status(200).json({ ok: true, haveKey: Boolean(token) });
}
