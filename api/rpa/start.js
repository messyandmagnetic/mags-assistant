export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }
  const { url } = req.body || {};
  if (typeof url !== 'string' || !url) {
    res.status(400).json({ ok: false, error: 'Missing url' });
    return;
  }
  res.status(200).json({ ok: true, url });
}
