// Single multipurpose API to keep function count under 12
import type { VercelRequest, VercelResponse } from '@vercel/node'
import getRawBody from 'raw-body'

export const config = {
  api: { bodyParser: false } // needed for Stripe signature verification
}

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

    if (action === 'stripe-webhook') {
      const secret = process.env.STRIPE_WEBHOOK_SECRET
      if (!secret) return bad(res, 'MISSING_STRIPE_WEBHOOK_SECRET', 500)

      // Lazy import to avoid bundling stripe into non-webhook paths
      const { default: Stripe } = await import('stripe')
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' })

      // Verify signature
      const signature = req.headers['stripe-signature'] as string
      if (!signature) return bad(res, 'MISSING_STRIPE_SIGNATURE', 400)

      const raw = (await getRawBody(req)).toString('utf8')
      let event
      try {
        event = stripe.webhooks.constructEvent(raw, signature, secret)
      } catch (err: any) {
        return bad(res, `INVALID_SIGNATURE: ${err.message}`, 400)
      }

      // Minimal handling
      switch (event.type) {
        case 'checkout.session.completed':
        case 'payment_intent.succeeded':
          // TODO: queue Notion upsert / Telegram notify
          break
        default:
          // no-op
          break
      }

      return ok(res, { received: event.type })
    }

    return bad(res, `UNKNOWN_ACTION:${action}`, 404)
  } catch (e: any) {
    console.error('ops error:', e)
    return bad(res, 'INTERNAL_ERROR', 500)
  }
}
