# Mags Assistant

Production domain: https://mags-assistant.vercel.app

Test links:

- https://mags-assistant.vercel.app/ — landing page
- https://mags-assistant.vercel.app/watch — viewer page
- https://mags-assistant.vercel.app/hello
- https://mags-assistant.vercel.app/diag
- https://mags-assistant.vercel.app/health
- https://mags-assistant.vercel.app/console — simple command console
- https://mags-assistant.vercel.app/chat — chat page
- https://mags-assistant.vercel.app/studio — studio page
- https://mags-assistant.vercel.app/planner — planner page

Example curl for /start:

```sh
curl -X POST 'https://mags-assistant.vercel.app/api/rpa?action=start' \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

## Chat UI

The `/chat` interface requires the following environment variables:

- `OPENAI_API_KEY` – API key for OpenAI requests.
- `CHAT_PASSWORD` – optional password protecting the chat. If unset, the page warns that auth is disabled.
- `NOTION_TOKEN` – token for Notion API access.
- `NOTION_HQ_PAGE_ID` – Notion HQ page ID.
- `NOTION_QUEUE_DB` – Notion queue database ID.
- `PRODUCTS_DB_ID` – Notion database ID for Stripe products.
- `DONOR_DB_ID` – Notion database ID for donor tracking.
- `OUTREACH_DB_ID` – Notion database ID for outreach tracking.
- `CONTENT_DB_ID` – Notion database ID for content planning.
- `STRIPE_SECRET_KEY` – Stripe API key.
- `RESEND_API_KEY` – optional; API key for sending email notifications.
- `NOTIFY_EMAIL` – optional email address for notifications.
- `NOTIFY_WEBHOOK` – optional webhook for outgoing notifications.
- `BRAND_PRIMARY_HEX` – optional primary color override.
- `BRAND_SECONDARY_HEX` – optional secondary color override.
- `TELEGRAM_BOT_TOKEN` – optional; token for Telegram bot notifications.
- `TELEGRAM_CHAT_ID` – optional; target chat for Telegram notifications.
- `APPROVAL_MODE` – optional; set `strict`, `normal`, or `auto` for message approvals.

## Notifications & Telegram

Configure optional outbound notifications.

- Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` to enable Telegram messages.
- Optionally define `RESEND_API_KEY` and `NOTIFY_EMAIL` for email alerts or `NOTIFY_WEBHOOK` for custom webhooks.
- Send notifications via `POST /api/notify`.
- Telegram webhook URL: https://assistant.messyandmagnetic.com/api/telegram
- Approval webhook: https://assistant.messyandmagnetic.com/api/approve

### Telegram approvals

Proposal notifications include inline **Approve/Decline** buttons.
Button presses send `{actionId, runId, kind}` to `/api/approve` which
invokes the relevant worker (`sendOutreach`, schedules a follow-up, or
marks content approved). Declines mark the run as **Rejected**.

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

### Required environment variables

- `NOTION_TOKEN` – Notion internal integration token
- `NOTION_HQ_PAGE_ID` – parent page where the queue database lives
- `NOTION_QUEUE_DB` – database ID of "Maggie Job Queue" (created on first seed)

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

## Unread badge

`GET /api/chat/unread` returns `{ count }`. The header and dashboard poll this endpoint every 30s and show a red badge on the Chat link when the count is greater than zero. Opening `/chat` clears the count.

## Planner

The planner at `/planner` shows queued, running, and completed jobs from Notion.

## Studio

The video studio at `/studio` trims clips and exports MP4 or SRT files.

## Research

_(coming soon)_

## Memory

_(coming soon)_

## Email triage

_(coming soon)_

## Grant pack

_(coming soon)_

## Stripe audit

_(coming soon)_

## Content planner

_(coming soon)_
