// Single multipurpose API to keep function count under 12
import type { VercelRequest, VercelResponse } from '@vercel/node'

function ok(res: VercelResponse, data: any = {}) {
  res.status(200).json({ ok: true, ...data })
}
function bad(res: VercelResponse, msg: string, code = 400) {
  res.status(code).json({ ok: false, error: msg })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = (req.query.action as string) || 'status'

  try {
    if (action === 'status') {
      const present = ['STRIPE_WEBHOOK_SECRET', 'NEXT_PUBLIC_FETCH_PASS']
        .filter(k => process.env[k as keyof NodeJS.ProcessEnv])
      return ok(res, { envs: present, now: new Date().toISOString() })
    }

    if (action === 'check') {
      return ok(res, { ping: 'pong' })
    }

    return bad(res, `UNKNOWN_ACTION:${action}`, 404)
  } catch (e: any) {
    console.error('ops error:', e)
    return bad(res, 'INTERNAL_ERROR', 500)
  }
}
