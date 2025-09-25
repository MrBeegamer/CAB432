#!/usr/bin/env bash
set -euo pipefail

BASE="http://localhost:8080"
USERNAME="angus"
PASSWORD="pass123"
FILE_ID="T6LhB7JZYS"   # your existing file
PRESET="720p"          # bump to 1080p for heavier CPU load
CONCURRENCY=6
DURATION_SEC=300       # 5 minutes

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "Missing $1"; exit 1; }; }
require_cmd curl
require_cmd jq

login() {
  TOKEN="$(curl -s -X POST "$BASE/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" | jq -r .token)"
  if [[ -z "$TOKEN" || "$TOKEN" == "null" ]]; then
    echo "Login failed"; exit 1
  fi
}

transcode_once() {
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/videos/transcode" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"fileId\":\"$FILE_ID\",\"preset\":\"$PRESET\"}")
  if [[ "$code" == "401" ]]; then
    login
    curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/videos/transcode" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "{\"fileId\":\"$FILE_ID\",\"preset\":\"$PRESET\"}" >/dev/null
  fi
}

worker() {
  local end=$((SECONDS + DURATION_SEC))
  while [ $SECONDS -lt $end ]; do
    transcode_once || true
  done
}

echo "Logging in and starting load test for $DURATION_SEC sec with $CONCURRENCY workers…"
login
for i in $(seq 1 "$CONCURRENCY"); do worker & done
wait
echo "Done."

