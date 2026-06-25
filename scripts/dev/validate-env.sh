#!/usr/bin/env bash
set -euo pipefail

# Ancore Local Environment Validator
# Checks health endpoints of configured services

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Defaults (override in .env.local or environment)
INDEXER_URL="${INDEXER_URL:-http://localhost:8080}"
RELAYER_URL="${RELAYER_URL:-http://localhost:3001}"
AI_AGENT_URL="${AI_AGENT_URL:-http://localhost:3002}"

failed=0

# Header
echo "─────────────────────────────────────────────────"
echo "Ancore Service Health Check"
echo "─────────────────────────────────────────────────"
echo ""

# ──────────────────────────────────────────────────────────────────────────────
# Health Check Function
# ──────────────────────────────────────────────────────────────────────────────

check_service() {
  local name=$1
  local url=$2
  local health_path="${3:-/health}"

  echo -n "Checking ${name}... "

  if curl -sf "${url}${health_path}" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ OK${NC}"
    return 0
  else
    echo -e "${RED}✗ FAILED${NC} (${url}${health_path})"
    return 1
  fi
}

# ──────────────────────────────────────────────────────────────────────────────
# Service Checks
# ──────────────────────────────────────────────────────────────────────────────

echo "Services:"

check_service "Indexer" "${INDEXER_URL}" || ((failed++))
check_service "Relayer" "${RELAYER_URL}" || ((failed++))
check_service "AI Agent" "${AI_AGENT_URL}" || ((failed++))

echo ""

# ──────────────────────────────────────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────────────────────────────────────

if [ $failed -eq 0 ]; then
  echo -e "${GREEN}All services healthy!${NC}"
  exit 0
else
  echo -e "${RED}${failed} service(s) failed health check.${NC}"
  echo ""
  echo "Tips:"
  echo "  - Indexer:  pnpm --filter @ancore/indexer dev"
  echo "  - Relayer:  pnpm --filter @ancore/relayer dev"
  echo "  - AI Agent: pnpm --filter @ancore/ai-agent dev"
  echo ""
  exit 1
fi
