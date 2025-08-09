export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }

  try {
    const { command } = req.body || {};
    if (!command) {
      res.status(400).json({ ok: false, error: 'Missing command' });
      return;
    }

    if (command.toLowerCase().includes('hello')) {
      res.status(200).json({ ok: true, message: 'Hello to you too!' });
      return;
    }

    res.status(200).json({ ok: true, message: `Command not recognized: ${command}` });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
}
