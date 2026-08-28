#!/usr/bin/env bash
set -euo pipefail

# Ancore Docker Compose Stack Smoke Test
# Curls health endpoints after docker-compose up to verify services are healthy
# Exits 0 when all services are healthy, exits 1 otherwise
# Timeout: 30 seconds

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
TIMEOUT=30
SLEEP_INTERVAL=2

# Service endpoints (as per docker-compose.dev.yml and issue #569)
INDEXER_HEALTH="http://localhost:8080/health"
RELAYER_STATUS="http://localhost:3000/relay/status"

# Timer
elapsed=0

echo "─────────────────────────────────────────────────"
echo "Ancore Docker Compose Smoke Test"
echo "─────────────────────────────────────────────────"
echo ""
echo "Waiting for services to become healthy (timeout: ${TIMEOUT}s)..."
echo ""

# ──────────────────────────────────────────────────────────────────────────────
# Health Check Function
# ──────────────────────────────────────────────────────────────────────────────

check_service() {
  local name=$1
  local url=$2

  if curl -sf "${url}" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ ${name} healthy${NC} (${url})"
    return 0
  else
    echo -e "${RED}✗ ${name} not responding${NC} (${url})"
    return 1
  fi
}

# ──────────────────────────────────────────────────────────────────────────────
# Wait and Check Loop
# ──────────────────────────────────────────────────────────────────────────────

while [ $elapsed -lt $TIMEOUT ]; do
  # Check all services
  indexer_healthy=false
  relayer_healthy=false

  echo -n "[$(printf '%02d' $elapsed)/${TIMEOUT}s] Checking services... "

  if check_service "Indexer" "${INDEXER_HEALTH}"; then
    indexer_healthy=true
  fi

  if check_service "Relayer" "${RELAYER_STATUS}"; then
    relayer_healthy=true
  fi

  # If both are healthy, exit successfully
  if [ "$indexer_healthy" = true ] && [ "$relayer_healthy" = true ]; then
    echo ""
    echo -e "${GREEN}All services healthy!${NC}"
    exit 0
  fi

  # Wait before next check
  sleep $SLEEP_INTERVAL
  elapsed=$((elapsed + SLEEP_INTERVAL))
done

# ──────────────────────────────────────────────────────────────────────────────
# Timeout Handler
# ──────────────────────────────────────────────────────────────────────────────

echo ""
echo -e "${RED}Timeout reached (${TIMEOUT}s). Some services are not healthy.${NC}"
echo ""
echo "Tips:"
echo "  - Check if docker-compose up completed successfully: docker-compose ps"
echo "  - Check service logs: docker-compose logs"
echo "  - Ensure ports are not in use by other processes"
echo ""
exit 1
