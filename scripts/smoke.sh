#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-https://mags-assistant.vercel.app}"

echo "Ping hello"; curl -fsS "$BASE/api/hello" | jq -e '.ok==true'

echo "Ping health"; curl -fsS "$BASE/api/rpa/health" | jq -e '.ok==true'

echo "Diag returns JSON"; curl -fsS "$BASE/api/rpa/diag" | jq -e '.ok!=null'

echo "Start rejects bad body"; curl -fsS -XPOST "$BASE/api/rpa/start" -H 'content-type: application/json' -d '{}' | jq -e '.ok==false'

echo "Start accepts good url"; curl -fsS -XPOST "$BASE/api/rpa/start" -H 'content-type: application/json' -d '{"url":"https://example.com"}' | jq -e '.ok==true and .jobId!=null'

echo "Viewer is reachable"; curl -fsS -I "$BASE/viewer" | grep -qE 'HTTP/.+ 200'

echo "Watch alias works"; curl -fsS -I "$BASE/watch" | grep -qE 'HTTP/.+ 200'

echo "Landing loads"; curl -fsS -I "$BASE/" | grep -qE 'HTTP/.+ 200'

echo "DONE"
