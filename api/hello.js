export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  res.status(200).json({ ok: true, hello: 'mags' });
}
