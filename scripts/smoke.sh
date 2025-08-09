#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-https://mags-assistant.vercel.app}"
jq --version >/dev/null 2>&1 || (echo "jq required" && exit 1)

echo "[hello]";     curl -fsS "$BASE/api/hello" | jq -e '.ok==true'
echo "[health]";    curl -fsS "$BASE/api/rpa/health" | jq -e '.ok==true'
echo "[diag]";      curl -fsS "$BASE/api/rpa/diag" | jq -e '.ok==true and .haveKeys!=null'
echo "[viewer]";    curl -fsSI "$BASE/viewer" | grep -qE 'HTTP/.* 200'
echo "[watch]";     curl -fsSI "$BASE/watch"  | grep -qE 'HTTP/.* 200'
echo "[start bad]"; curl -fsS -XPOST "$BASE/api/rpa/start" -H 'content-type: application/json' -d '{}' | jq -e '.ok==false'
echo "[start ok]";  curl -fsS -XPOST "$BASE/api/rpa/start" -H 'content-type: application/json' -d '{"url":"https://example.com"}' | jq -e '.ok==true and .jobId!=null'

echo "[analyze stub]"; curl -fsS -XPOST "$BASE/api/video/analyze" -H 'content-type: application/json' -d '{"url":"https://example.com/video.mp4"}' | jq -e '.ok==true and .hooks!=null'
echo "[trends digest]"; curl -fsS "$BASE/api/trends/digest?when=today" | jq -e '.ok==true and (.ideas|length)>=1'
echo "OK"
