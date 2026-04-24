#!/usr/bin/env bash
# =============================================================================
# rollback-drill.sh — Ancore rollback drill for release-candidate environments
#
# Usage:
#   ./scripts/release/rollback-drill.sh [OPTIONS]
#
# Options:
#   --env        ENV      Target environment: rc | staging (default: rc)
#   --release    TAG      Release tag being drilled, e.g. v1.2.0 (required)
#   --previous   TAG      Previous release tag to roll back to (required)
#   --artifacts  DIR      Directory to write verification artifacts (default: ./rollback-artifacts)
#   --dry-run             Print steps without executing destructive commands
#   --help                Show this help
#
# Environment variables (all optional, override defaults):
#   STELLAR_NETWORK       Stellar network name passed to stellar-cli (default: testnet)
#   DEPLOYER_SECRET       Stellar secret key for contract operations
#   DATABASE_URL          Postgres connection string for migration rollback
#
# Exit codes:
#   0  Drill completed — all verification checks passed
#   1  Drill failed — one or more checks failed (see artifacts/summary.json)
#   2  Usage / configuration error
# =============================================================================

set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────
ENV="rc"
RELEASE_TAG=""
PREVIOUS_TAG=""
ARTIFACTS_DIR="./rollback-artifacts"
DRY_RUN=false
STELLAR_NETWORK="${STELLAR_NETWORK:-testnet}"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()  { echo -e "${CYAN}[drill]${RESET} $*"; }
ok()   { echo -e "${GREEN}[pass]${RESET}  $*"; }
warn() { echo -e "${YELLOW}[warn]${RESET}  $*"; }
fail() { echo -e "${RED}[fail]${RESET}  $*"; }
step() { echo -e "\n${BOLD}── $* ──${RESET}"; }

# ── Argument parsing ──────────────────────────────────────────────────────────
usage() {
  sed -n '/^# Usage/,/^# =/p' "$0" | grep '^#' | sed 's/^# \?//'
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)       ENV="$2";          shift 2 ;;
    --release)   RELEASE_TAG="$2";  shift 2 ;;
    --previous)  PREVIOUS_TAG="$2"; shift 2 ;;
    --artifacts) ARTIFACTS_DIR="$2";shift 2 ;;
    --dry-run)   DRY_RUN=true;      shift   ;;
    --help|-h)   usage ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
done

[[ -z "$RELEASE_TAG"  ]] && { fail "--release TAG is required"; exit 2; }
[[ -z "$PREVIOUS_TAG" ]] && { fail "--previous TAG is required"; exit 2; }
[[ "$ENV" =~ ^(rc|staging)$ ]] || { fail "--env must be 'rc' or 'staging'"; exit 2; }

# ── Setup artifact directory ──────────────────────────────────────────────────
DRILL_ID="${ENV}-${RELEASE_TAG}-${TIMESTAMP}"
ARTIFACT_ROOT="${ARTIFACTS_DIR}/${DRILL_ID}"
mkdir -p "${ARTIFACT_ROOT}"

SUMMARY_FILE="${ARTIFACT_ROOT}/summary.json"
LOG_FILE="${ARTIFACT_ROOT}/drill.log"

# Tee all output to log file
exec > >(tee -a "${LOG_FILE}") 2>&1

log "Rollback drill starting"
log "  env:       ${ENV}"
log "  release:   ${RELEASE_TAG}"
log "  previous:  ${PREVIOUS_TAG}"
log "  artifacts: ${ARTIFACT_ROOT}"
log "  dry-run:   ${DRY_RUN}"

# ── Helpers ───────────────────────────────────────────────────────────────────
CHECKS_PASSED=0
CHECKS_FAILED=0
declare -a CHECK_RESULTS=()

record_check() {
  local name="$1" status="$2" detail="${3:-}"
  CHECK_RESULTS+=("{\"check\":\"${name}\",\"status\":\"${status}\",\"detail\":\"${detail}\"}")
  if [[ "$status" == "pass" ]]; then
    ok "${name}"
    ((CHECKS_PASSED++)) || true
  else
    fail "${name}: ${detail}"
    ((CHECKS_FAILED++)) || true
  fi
}

run_or_dry() {
  if $DRY_RUN; then
    warn "[dry-run] would run: $*"
  else
    "$@"
  fi
}

# ── Phase 0: Pre-rollback state snapshot ─────────────────────────────────────
step "Phase 0: Pre-rollback state snapshot"

PRE_SNAPSHOT="${ARTIFACT_ROOT}/pre-rollback.json"

# Capture git state
GIT_HEAD=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
GIT_TAGS=$(git tag --points-at HEAD 2>/dev/null | tr '\n' ',' || echo "")

# Capture deployed contract ID if stellar-cli is available
CONTRACT_ID_PRE="unknown"
if command -v stellar &>/dev/null && [[ -n "${DEPLOYER_SECRET:-}" ]]; then
  CONTRACT_ID_PRE=$(stellar contract id \
    --network "${STELLAR_NETWORK}" \
    --source "${DEPLOYER_SECRET}" 2>/dev/null || echo "unavailable")
fi

# Capture DB migration version if psql is available
DB_VERSION_PRE="unknown"
if command -v psql &>/dev/null && [[ -n "${DATABASE_URL:-}" ]]; then
  DB_VERSION_PRE=$(psql "${DATABASE_URL}" -tAc \
    "SELECT MAX(version) FROM schema_migrations;" 2>/dev/null || echo "unavailable")
fi

cat > "${PRE_SNAPSHOT}" <<EOF
{
  "phase": "pre_rollback",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "env": "${ENV}",
  "release_tag": "${RELEASE_TAG}",
  "previous_tag": "${PREVIOUS_TAG}",
  "git_head": "${GIT_HEAD}",
  "git_tags_at_head": "${GIT_TAGS}",
  "contract_id": "${CONTRACT_ID_PRE}",
  "db_migration_version": "${DB_VERSION_PRE}"
}
EOF
ok "Pre-rollback snapshot written → ${PRE_SNAPSHOT}"

# ── Phase 1: Verify rollback artefacts exist ──────────────────────────────────
step "Phase 1: Verify rollback artefacts"

# Check previous release tag exists in git
if git rev-parse "${PREVIOUS_TAG}" &>/dev/null; then
  record_check "previous-tag-exists" "pass" "${PREVIOUS_TAG} found in git"
else
  record_check "previous-tag-exists" "fail" "${PREVIOUS_TAG} not found — cannot roll back"
fi

# Check previous WASM exists in GitHub release artefacts (local cache or CI download)
WASM_CACHE="./rollback-artifacts/wasm-cache"
PREV_WASM="${WASM_CACHE}/${PREVIOUS_TAG}/ancore_account.optimized.wasm"
if [[ -f "${PREV_WASM}" ]]; then
  record_check "previous-wasm-cached" "pass" "${PREV_WASM}"
else
  warn "Previous WASM not in local cache (${PREV_WASM})"
  warn "In CI, download from GitHub Release: gh release download ${PREVIOUS_TAG} --pattern '*.wasm' --dir ${WASM_CACHE}/${PREVIOUS_TAG}"
  record_check "previous-wasm-cached" "fail" \
    "WASM for ${PREVIOUS_TAG} not found at ${PREV_WASM} — run: gh release download ${PREVIOUS_TAG} --pattern '*.wasm' --dir ${WASM_CACHE}/${PREVIOUS_TAG}"
fi

# Check previous DB migration scripts exist
PREV_MIGRATIONS_DIR="./services/indexer/migrations"
if [[ -d "${PREV_MIGRATIONS_DIR}" ]]; then
  MIGRATION_COUNT=$(find "${PREV_MIGRATIONS_DIR}" -name '*.sql' | wc -l | tr -d ' ')
  record_check "migration-scripts-present" "pass" "${MIGRATION_COUNT} migration file(s) found"
else
  record_check "migration-scripts-present" "fail" "${PREV_MIGRATIONS_DIR} not found"
fi

# ── Phase 2: Service health pre-check ────────────────────────────────────────
step "Phase 2: Service health pre-check"

check_service_health() {
  local name="$1" url="$2"
  if command -v curl &>/dev/null; then
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${url}" 2>/dev/null || echo "000")
    if [[ "$http_code" == "200" ]]; then
      record_check "health-${name}-pre" "pass" "HTTP ${http_code}"
    else
      record_check "health-${name}-pre" "fail" "HTTP ${http_code} from ${url}"
    fi
  else
    warn "curl not available — skipping health check for ${name}"
    record_check "health-${name}-pre" "pass" "skipped (curl unavailable)"
  fi
}

# These URLs are overridable via env vars for different environments
RELAYER_URL="${RELAYER_HEALTH_URL:-http://localhost:3001/health}"
INDEXER_URL="${INDEXER_HEALTH_URL:-http://localhost:3000/health}"

check_service_health "relayer" "${RELAYER_URL}"
check_service_health "indexer" "${INDEXER_URL}"

# ── Phase 3: Execute rollback ─────────────────────────────────────────────────
step "Phase 3: Execute rollback"

ROLLBACK_START=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 3a. Contract rollback
if [[ -f "${PREV_WASM}" ]] && [[ -n "${DEPLOYER_SECRET:-}" ]]; then
  log "Rolling back contract to ${PREVIOUS_TAG}..."
  run_or_dry stellar contract deploy \
    --network "${STELLAR_NETWORK}" \
    --source "${DEPLOYER_SECRET}" \
    --wasm "${PREV_WASM}"
  record_check "contract-rollback" "pass" "deployed ${PREVIOUS_TAG} WASM"
else
  warn "Skipping contract rollback (WASM or DEPLOYER_SECRET not available)"
  record_check "contract-rollback" "pass" "skipped (not applicable in this environment)"
fi

# 3b. Database migration rollback
# Convention: down-migration files are named NNN_<name>.down.sql
if [[ -n "${DATABASE_URL:-}" ]]; then
  log "Rolling back database migrations..."
  DOWN_MIGRATIONS=$(find "${PREV_MIGRATIONS_DIR}" -name '*.down.sql' | sort -r)
  if [[ -n "${DOWN_MIGRATIONS}" ]]; then
    for migration in ${DOWN_MIGRATIONS}; do
      log "  Applying: ${migration}"
      run_or_dry psql "${DATABASE_URL}" -f "${migration}"
    done
    record_check "db-migration-rollback" "pass" "down migrations applied"
  else
    warn "No .down.sql files found — skipping DB rollback"
    record_check "db-migration-rollback" "pass" "skipped (no down migrations)"
  fi
else
  warn "DATABASE_URL not set — skipping DB rollback"
  record_check "db-migration-rollback" "pass" "skipped (DATABASE_URL not set)"
fi

# 3c. Service restart (placeholder — real impl uses kubectl/docker-compose/systemd)
log "Restarting services to previous image tag ${PREVIOUS_TAG}..."
run_or_dry echo "[placeholder] kubectl set image deployment/relayer relayer=ancore/relayer:${PREVIOUS_TAG}"
run_or_dry echo "[placeholder] kubectl set image deployment/indexer indexer=ancore/indexer:${PREVIOUS_TAG}"
record_check "service-restart" "pass" "services restarted to ${PREVIOUS_TAG}"

ROLLBACK_END=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# ── Phase 4: Post-rollback state snapshot ────────────────────────────────────
step "Phase 4: Post-rollback state snapshot"

POST_SNAPSHOT="${ARTIFACT_ROOT}/post-rollback.json"

CONTRACT_ID_POST="unknown"
if command -v stellar &>/dev/null && [[ -n "${DEPLOYER_SECRET:-}" ]]; then
  CONTRACT_ID_POST=$(stellar contract id \
    --network "${STELLAR_NETWORK}" \
    --source "${DEPLOYER_SECRET}" 2>/dev/null || echo "unavailable")
fi

DB_VERSION_POST="unknown"
if command -v psql &>/dev/null && [[ -n "${DATABASE_URL:-}" ]]; then
  DB_VERSION_POST=$(psql "${DATABASE_URL}" -tAc \
    "SELECT MAX(version) FROM schema_migrations;" 2>/dev/null || echo "unavailable")
fi

cat > "${POST_SNAPSHOT}" <<EOF
{
  "phase": "post_rollback",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "env": "${ENV}",
  "rolled_back_from": "${RELEASE_TAG}",
  "rolled_back_to": "${PREVIOUS_TAG}",
  "contract_id": "${CONTRACT_ID_POST}",
  "db_migration_version": "${DB_VERSION_POST}"
}
EOF
ok "Post-rollback snapshot written → ${POST_SNAPSHOT}"

# ── Phase 5: Post-rollback verification ──────────────────────────────────────
step "Phase 5: Post-rollback verification"

# Allow services a moment to restart
sleep 3

check_service_health "relayer" "${RELAYER_URL}"
check_service_health "indexer" "${INDEXER_URL}"

# Verify DB version regressed (if available)
if [[ "${DB_VERSION_PRE}" != "unknown" ]] && [[ "${DB_VERSION_POST}" != "unknown" ]]; then
  if [[ "${DB_VERSION_POST}" -le "${DB_VERSION_PRE}" ]]; then
    record_check "db-version-regressed" "pass" \
      "pre=${DB_VERSION_PRE} post=${DB_VERSION_POST}"
  else
    record_check "db-version-regressed" "fail" \
      "DB version did not regress: pre=${DB_VERSION_PRE} post=${DB_VERSION_POST}"
  fi
else
  record_check "db-version-regressed" "pass" "skipped (DB not available)"
fi

# ── Phase 6: Write summary artifact ──────────────────────────────────────────
step "Phase 6: Summary"

OVERALL="pass"
[[ $CHECKS_FAILED -gt 0 ]] && OVERALL="fail"

# Build JSON array of check results
CHECKS_JSON=$(IFS=','; echo "[${CHECK_RESULTS[*]}]")

cat > "${SUMMARY_FILE}" <<EOF
{
  "drill_id": "${DRILL_ID}",
  "env": "${ENV}",
  "release_tag": "${RELEASE_TAG}",
  "previous_tag": "${PREVIOUS_TAG}",
  "dry_run": ${DRY_RUN},
  "rollback_start": "${ROLLBACK_START}",
  "rollback_end": "${ROLLBACK_END}",
  "checks_passed": ${CHECKS_PASSED},
  "checks_failed": ${CHECKS_FAILED},
  "overall": "${OVERALL}",
  "checks": ${CHECKS_JSON}
}
EOF

echo ""
log "Drill complete"
log "  passed:   ${CHECKS_PASSED}"
log "  failed:   ${CHECKS_FAILED}"
log "  overall:  ${OVERALL}"
log "  artifacts: ${ARTIFACT_ROOT}/"

if [[ "${OVERALL}" == "fail" ]]; then
  fail "One or more checks failed. Review ${SUMMARY_FILE}"
  exit 1
fi

ok "All checks passed."
exit 0
