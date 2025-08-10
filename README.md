# Mags Assistant

Production domain: https://mags-assistant.vercel.app

Test links:

- https://mags-assistant.vercel.app/ — landing page
- https://mags-assistant.vercel.app/watch — viewer page
- https://mags-assistant.vercel.app/hello
- https://mags-assistant.vercel.app/diag
- https://mags-assistant.vercel.app/health

Example curl for start:

```sh
curl -X POST 'https://mags-assistant.vercel.app/api/rpa?action=start' \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

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
- **Required secrets:** `WORKER_KEY`, `NOTION_TOKEN`, `NOTION_PAGE_ID`, `OPENAI_API_KEY`, and optional email alerts `ALERT_EMAIL_USER`, `ALERT_EMAIL_PASS`, `ALERT_TO`.
- **Change schedule:** edit the cron expression under `on.schedule` in the workflow file.
- **Endpoints:** the runner claims jobs from `/api/queue/next` and processes them via `/api/queue/run`.

The current schedule runs every 10 minutes.
