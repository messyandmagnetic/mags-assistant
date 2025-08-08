# Mags Assistant

This is the starter project for your soul-aligned assistant.
It includes structure for Google API auth, task automation, and third-party integrations.

## Environment Variables

The following variables must be configured in Vercel:

- `OPENAI_API_KEY`
- `BROWSERLESS_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `STRIPE_SECRET_KEY`

## How to test

- GET `/api/rpa/health` → `{ ok: true }`
- POST `/api/run-command` with `{ "command": "hello" }`
- Visit `/watch.html?url=https%3A%2F%2Fdashboard.stripe.com%2Flogin`
