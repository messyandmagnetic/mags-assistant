# Cloudflare Cron

Create the following HTTP **POST** triggers in the Cloudflare Dashboard for the worker:

| Cron | Description | URL |
| --- | --- | --- |
| `0 14 * * *` | Daily Digest | https://tight-snow-2840.messyandmagnetic.workers.dev/digest |
| `*/30 * * * *` | Status Packet (every 30 min) | https://tight-snow-2840.messyandmagnetic.workers.dev/status-packet |
| `15 14 * * *` | Land Scan | https://tight-snow-2840.messyandmagnetic.workers.dev/land/scan |
| `20 14 * * *` | Land Summary | https://tight-snow-2840.messyandmagnetic.workers.dev/land/summary |

If `FETCH_PASS` protection is enabled, add header `X-Fetch-Pass: $FETCH_PASS` in the **HTTP Headers (optional)** box.

In the Cloudflare dashboard, navigate to **Workers → Triggers → Cron Triggers** and add each schedule using the cron string from above.
