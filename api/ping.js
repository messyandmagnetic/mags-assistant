export default (req, res) => res.status(200).json({ ok: true, runtime: 'node', ts: Date.now() });
