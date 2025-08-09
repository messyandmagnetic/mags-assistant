# Mags Assistant

This is the starter project for your soul-aligned assistant.
It includes structure for Google API auth, task automation, and third-party integrations.

## Smoke-test links
- /api/hello
- /api/rpa/diag
- /api/rpa/health
- /api/rpa/start?ttl=45000
- /watch

Troubleshooting: ensure Vercel envs `BROWSERLESS_BASE`, `BROWSERLESS_API_KEY` (or `BROWSERLESS_TOKEN`) are set in Production; redeploy after changing envs.

## Environment Variables

The following variables must be configured in Vercel:

- `OPENAI_API_KEY`
- `BROWSERLESS_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `STRIPE_SECRET_KEY`
