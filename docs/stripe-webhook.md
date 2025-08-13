# Stripe Webhook

Use these steps to send a test event to the Cloudflare Worker endpoint.

1. Visit the [Stripe dashboard webhook page](https://dashboard.stripe.com/test/webhooks).
2. Locate the endpoint pointing to `https://tight-snow-2840.messyandmagnetic.workers.dev/api/stripe/webhook`.
3. Click **Send test event** and choose any event type.
4. Confirm the response shows `{ "ok": true }` and that the Worker returns a 2xx status.
