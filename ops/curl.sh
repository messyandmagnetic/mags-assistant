#!/usr/bin/env bash
set -euo pipefail
BASE=${WORKER_URL:-https://tight-snow-2840.messyandmagnetic.workers.dev}
PASS=${FETCH_PASS:-}
HEADER=()
if [ -n "$PASS" ]; then HEADER=(-H "X-Fetch-Pass: $PASS"); fi

curl -s "$BASE/health"
curl -s -X POST "${HEADER[@]}" "$BASE/land/scan"
curl -s -X POST "${HEADER[@]}" "$BASE/land/summary"
curl -s -X POST "${HEADER[@]}" "$BASE/digest"
