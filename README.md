# Mags Assistant

Production smoke tests:

- `/` — landing page
- `/watch` — viewer page (dropdown, text field, Start, Run Both)
- `/api/hello` → `{ ok:true, hello:"mags" }`
- `/api/rpa/diag` → shows ok, base, haveKey
- `/api/rpa/health` → `{ ok:true }` (when Browserless up)
- `curl -X POST https://mags-assistant.vercel.app/api/rpa/start -H 'Content-Type: application/json' -d '{"url":"https://example.com"}'`
