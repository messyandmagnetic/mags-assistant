# Mags Assistant

Production domain: https://mags-assistant.vercel.app

Test links:

- https://mags-assistant.vercel.app/ — landing page
- https://mags-assistant.vercel.app/watch — viewer page
- https://mags-assistant.vercel.app/hello
- https://mags-assistant.vercel.app/diag
- https://mags-assistant.vercel.app/health
- https://mags-assistant.vercel.app/console — simple command console

Example curl for start:

```sh
curl -X POST 'https://mags-assistant.vercel.app/api/rpa?action=start' \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

## Chat UI

The `/chat` interface requires these env vars:

```
OPENAI_API_KEY
CHAT_PASSWORD
NOTION_TOKEN
NOTION_HQ_PAGE_ID
NOTION_QUEUE_DB
STRIPE_SECRET_KEY

# optional notifications / branding
RESEND_API_KEY
NOTIFY_EMAIL
NOTIFY_WEBHOOK
BRAND_PRIMARY_HEX
BRAND_SECONDARY_HEX
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

## Notifications & Telegram

When `/api/notify` is called, the assistant can send emails via Resend and Telegram messages. Telegram messages include one‑click **Approve** and **View** buttons. Approved actions are sent to `/api/action` with `{ id, action }` and require `Authorization: Bearer $CHAT_PASSWORD`.

## Scheduled Tasks (free)
We run a free scheduler using GitHub Actions that calls `/api/cron/tick` every 15 minutes.

### Configure
- Vercel env:
  - NOTION_TOKEN = <internal integration token>
  - NOTION_ROOT_PAGE_ID = <the HQ page id>
  - (optional) CRON_SECRET = <random string>
- GitHub Repo → Settings → Secrets and variables → Actions:
  - NOTION_TOKEN / NOTION_ROOT_PAGE_ID / CRON_SECRET (match Vercel)

### Endpoints
- GET /api/notion/diag      → verifies Notion connectivity
- GET /api/cron/tick?dry=1  → shows which tasks would run
- GET /api/cron/tick        → runs all tasks
- GET /api/cron/tick?only=notion.sync_hq&only=social.refresh_planner  → run subset

### Add your own tasks
Create a file in `apps/api/lib/tasks/your-task.ts` that exports `async function myTask()`.
Add it to `tasks` in `apps/api/lib/tasks/index.ts` with a unique key.

## Scheduler

Automated jobs are processed by a GitHub Actions workflow located at `.github/workflows/cron-runner.yml`.

- **Manual trigger:** Open the [Actions page](https://github.com/messyandmagnetic/mags-assistant/actions), select `mags-cron`, and choose "Run workflow".
- **Required secrets:** `API_BASE`, `WORKER_KEY`, `NOTION_TOKEN`, `NOTION_PAGE_ID`, `OPENAI_API_KEY`, and optional email alerts `ALERT_EMAIL_USER`, `ALERT_EMAIL_PASS`, `ALERT_TO`.
- **Change schedule:** edit the cron expression under `on.schedule` in the workflow file.
- **Endpoints:** the runner claims jobs from `/api/queue/claim`, runs them via `/api/queue/run`, and marks them done with `/api/queue/complete`.

The current schedule runs every 10 minutes.

## Maggie Job Queue

Automated jobs for Maggie are tracked in a Notion database named **Maggie Job Queue** under the HQ page.

### Reseed

To recreate the database and seed the initial job, call:

```sh
curl -X POST "$API_BASE/api/queue/seed" -H "x-mags-key: $CRON_SECRET"
```

## Fallback Ops

Manual Stripe/Notion tasks can run via GitHub Actions when Mags is offline.

### Required secrets
Set these in Repo → Settings → Secrets and variables → Actions:
- `NOTION_TOKEN` – internal Notion integration
- `PRODUCTS_DB_ID` – ID of the "Stripe Product Tracker" database
- `STRIPE_SECRET_KEY`
- optional: `RESEND_API_KEY`, `NOTIFY_EMAIL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

### Run
1. Open **GitHub → Actions** and select **mags-ops-fallback**.
2. Click **Run workflow**.
3. Choose a task (e.g. `sync-stripe-from-notion`) and start with **Dry run** = true.
4. Inspect the logs, then re-run with **Dry run** = false to apply changes.
