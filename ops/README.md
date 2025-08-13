# Ops Checks

Quick curl tests for the deployed worker.

```bash
# Health
curl -s https://tight-snow-2840.messyandmagnetic.workers.dev/health

# Scan
curl -s -X POST -H "X-Fetch-Pass: $FETCH_PASS" \
  https://tight-snow-2840.messyandmagnetic.workers.dev/land/scan

# Summary
curl -s -X POST -H "X-Fetch-Pass: $FETCH_PASS" \
  https://tight-snow-2840.messyandmagnetic.workers.dev/land/summary

# Digest
curl -s -X POST -H "X-Fetch-Pass: $FETCH_PASS" \
  https://tight-snow-2840.messyandmagnetic.workers.dev/digest
```

Set `FETCH_PASS` in your shell when required.
