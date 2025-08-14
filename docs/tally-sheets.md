# Tally → Google Sheets Intake

This project centralizes Tally form responses in Google Sheets using a single Google Apps Script web app and the existing Cloudflare Worker webhook.

## Sheets and Tabs

| Form | Sheet ID | Tab |
| --- | --- | --- |
| Quiz (`3qlZQ9`) | `1JCcWIU7Mry540o3dpYlIvR0k4pjsGF743bG8vu8cds0` | `Quiz_Responses` |
| Feedback (`nGPKDo`) | `1DdqXoAdV-VQ565aHzJ9W0qsG5IJqpRBf7FE6-HkzZm8` | `Feedback_Responses` |
| Logs | in same sheet as target | `Logs` |

All response tabs use the normalized header set:
```
timestamp, form_id, submission_id, email, full_name, phone,
product_choice, score, result_tier, rating, feedback_text,
source, user_agent, ip, raw_json
```

## Apps Script Web App

Deploy the script in `apps-script/TallyIntake/Code.gs` as a web app and note the **Web App URL**.

a. In the Cloudflare Worker environment set `GAS_INTAKE_URL` to this URL.

b. Redeploy the Worker so it forwards Tally payloads to Apps Script.

### Deploying a New Version
1. Open the Apps Script project.
2. `Deploy → Manage deployments` → `New deployment`.
3. Choose **Web app**, execute as **Me**, and allow access to **Anyone**.
4. Update `GAS_INTAKE_URL` if the URL changes.

## Webhooks

Tally forms still post to the existing Worker URL. The Worker forwards the raw JSON to Apps Script. To disable direct posts, ensure no Apps Script URL is set in Tally’s webhook settings.

## Backfill

If `TALLY_API_KEY` is available, set it as a Script Property and run the `backfill` function from the Apps Script editor. It fetches all historical responses for both forms and writes them through the same pipeline with dedupe.

## Maintenance Functions

| Function | Purpose |
| --- | --- |
| `fixHeaders` | Ensure header row matches the canonical schema. |
| `dedupeAll` | Remove duplicate rows based on `submission_id`. |
| `backfill` | Fetch past responses using the Tally API. |
| `testInsert` | Insert synthetic rows into both tabs. |

Run these from the Apps Script editor’s **Run** menu.

## Health Check

GET `https://<web-app-url>/health` returns:
```json
{ "ok": true, "tabs": ["Quiz_Responses", "Feedback_Responses"] }
```

## Worker Notes

The Worker verifies the `tally-signature` header and forwards the exact body and headers to `GAS_INTAKE_URL`. This avoids double posting and keeps the Worker URL stable.

## Disable double-writes

Exactly one live destination per form:

- Tally → Worker → Apps Script *(preferred)*
- Tally → Apps Script *(direct)*

Ensure any legacy Tally → Google Sheets integrations are **OFF** to prevent duplicate rows.
