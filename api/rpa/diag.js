export default async function handler(req, res) {
  const token = process.env.BROWSERLESS_API_KEY || process.env.BROWSERLESS_TOKEN;
  return res.status(200).json({ ok: true, haveKey: Boolean(token) });
}
