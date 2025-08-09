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

- https://mags-assistant.vercel.app/api/hello → `{ ok: true, hello: "mags" }`
- https://mags-assistant.vercel.app/api/rpa/diag → shows base and haveKey
- https://mags-assistant.vercel.app/api/rpa/health → `{ ok: true }`
- https://mags-assistant.vercel.app/watch → loads viewer page
