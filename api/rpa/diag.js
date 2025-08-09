export default function handler(req, res) {
  const base = process.env.BROWSERLESS_BASE ?? "(unset)";
  const haveKey = Boolean(process.env.BROWSERLESS_API_KEY);
  res.status(200).json({ ok: true, base, haveKey });
}
