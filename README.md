# Mags Assistant

Quick checks:

- `GET /` → shows landing page
- `GET /watch` → viewer loads (no 404)
- `GET /api/hello` → `{ ok: true }`
- `GET /api/rpa/diag`, `GET /api/rpa/health` → `{ ok: true }`
- `POST /api/rpa/start` example:

```
curl -X POST https://mags-assistant.vercel.app/api/rpa/start \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```
