import { env } from '../../lib/env.js';

function ok(res, data={}){ res.status(200).json({ ok: true, ...data }); }
function bad(res, reason){ res.status(401).json({ ok: false, reason }); }

export default async function(req, res) {
  const url = new URL(req.url, 'http://x');
  const secret = url.searchParams.get('secret');
  if (!secret || secret !== env.CRON_SECRET) return bad(res, 'unauthorized');
  ok(res);
}
