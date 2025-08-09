# Mags Assistant

Production domain: https://mags-assistant.vercel.app

Test links:

- https://mags-assistant.vercel.app/ — landing page
- https://mags-assistant.vercel.app/viewer — viewer page
- https://mags-assistant.vercel.app/api/hello
- https://mags-assistant.vercel.app/api/rpa/diag
- https://mags-assistant.vercel.app/api/rpa/health

Example curl for start:

```sh
curl -X POST https://mags-assistant.vercel.app/api/rpa/start \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

### Social scheduling stub

`/api/social/schedule` simply stores jobs in a JSON file. When ready to integrate with platforms like TikTok, connect OAuth and the TikTok Business API at this endpoint, ensuring compliance with their Terms of Service.
