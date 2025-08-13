# Context Builder

Generates shared project context files.

- `build_context.ts` – combines sources and writes docs in `/docs` and a rendered `/public/context.html`.
- `sources.yml` – list of inputs; missing sources are skipped with a log.

Run locally:

```bash
node --experimental-strip-types ops/context/build_context.ts
```

The script outputs:
- `docs/PROJECT_CONTEXT—messyandmagnetic.md`
- `docs/QUICK_START—current_step.md`
- `docs/LINKS—endpoints-and-dashboards.md`
- `public/context.html`

Optional mirrors to Notion and Drive run only if tokens are present, otherwise they log a skip message.
