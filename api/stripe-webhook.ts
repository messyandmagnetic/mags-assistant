import type { VercelRequest, VercelResponse } from '@vercel/node'
import getRawBody from 'raw-body'
import Stripe from 'stripe'

export const config = { api: { bodyParser: false } }

function bad(res: VercelResponse, msg: string, code = 400) {
  res.status(code).json({ ok: false, error: msg })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return bad(res, 'METHOD_NOT_ALLOWED', 405)

  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return bad(res, 'MISSING_STRIPE_WEBHOOK_SECRET', 500)

  const worker = process.env.WORKER_URL
  if (!worker) return bad(res, 'MISSING_WORKER_URL', 500)

  const signature = req.headers['stripe-signature'] as string
  if (!signature) return bad(res, 'MISSING_STRIPE_SIGNATURE')

  const raw = (await getRawBody(req)).toString('utf8')
  let event
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' })
    event = stripe.webhooks.constructEvent(raw, signature, secret)
  } catch (e: any) {
    return bad(res, 'INVALID_SIGNATURE')
  }

  const body = JSON.stringify({ type: event.type, data: event.data.object })
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (process.env.FETCH_PASS) headers['X-Fetch-Pass'] = process.env.FETCH_PASS

  try {
    await fetch(`${worker.replace(/\/$/, '')}/stripe/ingest`, { method: 'POST', headers, body })
  } catch (e: any) {
    // swallow network errors, but report
    return bad(res, 'FORWARD_FAILED', 502)
  }

  res.status(200).json({ ok: true })
}
