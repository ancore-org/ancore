#!/usr/bin/env bash
# curl-smoke-indexer.sh — Smoke-test the Ancore indexer API against a local stack.
#
# Usage:
#   bash scripts/curl-smoke-indexer.sh [BASE_URL] [ACCOUNT_ID]
#
# Defaults:
#   BASE_URL   = http://localhost:8080
#   ACCOUNT_ID = GABC123XYZ456DEF789GHI012JKL345MNO678PQR901STU234VWX567YZA
#
# Prerequisites:
#   - docker-compose stack running (docker-compose up -d)
#   - jq installed (brew install jq / apt install jq)
#
# The script exits with code 0 if all checks pass, 1 otherwise.

set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"
ACCOUNT="${2:-GABC123XYZ456DEF789GHI012JKL345MNO678PQR901STU234VWX567YZA}"
PASS=0
FAIL=0

green()  { echo -e "\033[32m✓  $*\033[0m"; }
red()    { echo -e "\033[31m✗  $*\033[0m"; }
header() { echo -e "\n\033[1m$*\033[0m"; }

check() {
  local label="$1"
  local status="$2"
  local expected="$3"
  if [ "$status" -eq "$expected" ]; then
    green "$label (HTTP $status)"
    PASS=$((PASS + 1))
  else
    red "$label — expected HTTP $expected, got $status"
    FAIL=$((FAIL + 1))
  fi
}

# ── 1. Health check ─────────────────────────────────────────────────────────
header "1. Health check"
echo "  $ curl -s $BASE_URL/health | jq"
HEALTH_STATUS=$(curl -s -o /tmp/ancore-health.json -w "%{http_code}" "$BASE_URL/health")
check "GET /health" "$HEALTH_STATUS" 200
echo "  Response:"
jq '.' /tmp/ancore-health.json 2>/dev/null || cat /tmp/ancore-health.json

# ── 2. List account activity (default pagination) ────────────────────────────
header "2. List account activity"
echo "  $ curl -s '$BASE_URL/api/v1/accounts/\$G/activity?limit=5' | jq"
ACTIVITY_STATUS=$(curl -s \
  -o /tmp/ancore-activity.json \
  -w "%{http_code}" \
  "$BASE_URL/api/v1/accounts/$ACCOUNT/activity?limit=5")
check "GET /api/v1/accounts/{G}/activity" "$ACTIVITY_STATUS" 200
echo "  Response (truncated):"
jq '{count: .pagination.count, has_next: .pagination.has_next_page, first_type: .data[0].activity_type}' \
  /tmp/ancore-activity.json 2>/dev/null || cat /tmp/ancore-activity.json

# ── 3. Filter by activity type ───────────────────────────────────────────────
header "3. Filter by activity_type=payment"
FILTER_STATUS=$(curl -s \
  -o /tmp/ancore-filter.json \
  -w "%{http_code}" \
  "$BASE_URL/api/v1/accounts/$ACCOUNT/activity?activity_type=payment&limit=5")
check "GET /api/v1/accounts/{G}/activity?activity_type=payment" "$FILTER_STATUS" 200

# ── 4. Cursor pagination ─────────────────────────────────────────────────────
header "4. Cursor pagination"
NEXT_CURSOR=$(jq -r '.pagination.next_cursor // empty' /tmp/ancore-activity.json 2>/dev/null || true)
if [ -n "$NEXT_CURSOR" ]; then
  PAGE2_STATUS=$(curl -s \
    -o /tmp/ancore-page2.json \
    -w "%{http_code}" \
    "$BASE_URL/api/v1/accounts/$ACCOUNT/activity?cursor_after=$NEXT_CURSOR&limit=5")
  check "GET /api/v1/accounts/{G}/activity?cursor_after=<cursor>" "$PAGE2_STATUS" 200
else
  echo "  (skipped — no next_cursor returned, data set may be empty)"
fi

# ── 5. Activity types ─────────────────────────────────────────────────────────
header "5. Activity types"
TYPES_STATUS=$(curl -s \
  -o /tmp/ancore-types.json \
  -w "%{http_code}" \
  "$BASE_URL/api/v1/accounts/$ACCOUNT/activity/types")
check "GET /api/v1/accounts/{G}/activity/types" "$TYPES_STATUS" 200

# ── 6. Structured error envelope ─────────────────────────────────────────────
header "6. Structured error envelope (limit > 100)"
ERROR_STATUS=$(curl -s \
  -o /tmp/ancore-error.json \
  -w "%{http_code}" \
  "$BASE_URL/api/v1/accounts/$ACCOUNT/activity?limit=500")
check "GET /api/v1/accounts/{G}/activity?limit=500 returns 4xx" "$ERROR_STATUS" 400
echo "  Error response:"
jq '.' /tmp/ancore-error.json 2>/dev/null || cat /tmp/ancore-error.json

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "────────────────────────────────────────"
echo "  Results: ${PASS} passed, ${FAIL} failed"
echo "────────────────────────────────────────"

[ "$FAIL" -eq 0 ]
