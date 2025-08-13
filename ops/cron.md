# Cloudflare Cron

Scheduled checks for the Cloudflare Worker.

- Health: https://tight-snow-2840.messyandmagnetic.workers.dev/health
- Status packet (requires auth header):
  - `POST https://tight-snow-2840.messyandmagnetic.workers.dev/status/packet`
  - Header: `X-Fetch-Pass: ${FETCH_PASS}`

Add a Cron trigger in Cloudflare Dashboard → Workers → tight-snow-2840 → Triggers → **Add Cron**.
