#!/usr/bin/env bash
# =============================================================================
# verify-artifacts.sh — Verify rollback drill artifact collection
#
# Validates that a completed drill produced all required artifacts and that
# the summary JSON is well-formed and reports an overall pass.
#
# Usage:
#   ./scripts/release/verify-artifacts.sh --drill-dir <path>
#
# Options:
#   --drill-dir  DIR   Path to a specific drill artifact directory
#   --artifacts  DIR   Root artifacts directory; verifies the latest drill
#   --help             Show this help
#
# Exit codes:
#   0  All artifacts present and valid
#   1  One or more artifacts missing or invalid
#   2  Usage error
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; RESET='\033[0m'

log()  { echo -e "${CYAN}[verify]${RESET} $*"; }
ok()   { echo -e "${GREEN}[pass]${RESET}   $*"; }
fail() { echo -e "${RED}[fail]${RESET}   $*"; }
warn() { echo -e "${YELLOW}[warn]${RESET}   $*"; }

DRILL_DIR=""
ARTIFACTS_ROOT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --drill-dir)  DRILL_DIR="$2";      shift 2 ;;
    --artifacts)  ARTIFACTS_ROOT="$2"; shift 2 ;;
    --help|-h)
      sed -n '/^# Usage/,/^# =/p' "$0" | grep '^#' | sed 's/^# \?//'
      exit 2 ;;
    *) echo "Unknown option: $1"; exit 2 ;;
  esac
done

# Resolve drill directory
if [[ -z "${DRILL_DIR}" ]]; then
  if [[ -z "${ARTIFACTS_ROOT}" ]]; then
    ARTIFACTS_ROOT="./rollback-artifacts"
  fi
  # Pick the most recent drill directory
  DRILL_DIR=$(find "${ARTIFACTS_ROOT}" -mindepth 1 -maxdepth 1 -type d \
    | sort | tail -1)
  if [[ -z "${DRILL_DIR}" ]]; then
    fail "No drill directories found in ${ARTIFACTS_ROOT}"
    exit 1
  fi
  log "Using latest drill: ${DRILL_DIR}"
fi

[[ -d "${DRILL_DIR}" ]] || { fail "Drill directory not found: ${DRILL_DIR}"; exit 1; }

ERRORS=0

check_file() {
  local path="$1" desc="$2"
  if [[ -f "${path}" ]]; then
    ok "${desc} present"
  else
    fail "${desc} MISSING: ${path}"
    ((ERRORS++)) || true
  fi
}

check_json_field() {
  local file="$1" field="$2" expected="$3"
  if ! command -v python3 &>/dev/null; then
    warn "python3 not available — skipping JSON field check for ${field}"
    return
  fi
  local actual
  actual=$(python3 -c "
import json, sys
d = json.load(open('${file}'))
val = d.get('${field}', '__missing__')
print(val)
" 2>/dev/null || echo "__error__")

  if [[ "${actual}" == "__missing__" ]]; then
    fail "Field '${field}' missing in ${file}"
    ((ERRORS++)) || true
  elif [[ "${actual}" == "__error__" ]]; then
    fail "Could not parse ${file}"
    ((ERRORS++)) || true
  elif [[ -n "${expected}" ]] && [[ "${actual}" != "${expected}" ]]; then
    fail "Field '${field}': expected '${expected}', got '${actual}'"
    ((ERRORS++)) || true
  else
    ok "Field '${field}' = '${actual}'"
  fi
}

# ── 1. Required files ─────────────────────────────────────────────────────────
log "Checking required artifact files..."

check_file "${DRILL_DIR}/summary.json"      "summary.json"
check_file "${DRILL_DIR}/pre-rollback.json" "pre-rollback.json"
check_file "${DRILL_DIR}/post-rollback.json" "post-rollback.json"
check_file "${DRILL_DIR}/drill.log"         "drill.log"

# ── 2. summary.json structure and result ─────────────────────────────────────
SUMMARY="${DRILL_DIR}/summary.json"
if [[ -f "${SUMMARY}" ]]; then
  log "Validating summary.json..."
  check_json_field "${SUMMARY}" "overall"        "pass"
  check_json_field "${SUMMARY}" "drill_id"       ""
  check_json_field "${SUMMARY}" "release_tag"    ""
  check_json_field "${SUMMARY}" "previous_tag"   ""
  check_json_field "${SUMMARY}" "rollback_start" ""
  check_json_field "${SUMMARY}" "rollback_end"   ""

  # Verify checks_failed == 0
  if command -v python3 &>/dev/null; then
    FAILED_COUNT=$(python3 -c "
import json
d = json.load(open('${SUMMARY}'))
print(d.get('checks_failed', -1))
" 2>/dev/null || echo "-1")
    if [[ "${FAILED_COUNT}" == "0" ]]; then
      ok "checks_failed = 0"
    else
      fail "checks_failed = ${FAILED_COUNT} (expected 0)"
      ((ERRORS++)) || true
    fi
  fi
fi

# ── 3. Pre/post snapshot consistency ─────────────────────────────────────────
PRE="${DRILL_DIR}/pre-rollback.json"
POST="${DRILL_DIR}/post-rollback.json"

if [[ -f "${PRE}" ]] && [[ -f "${POST}" ]] && command -v python3 &>/dev/null; then
  log "Checking pre/post snapshot consistency..."
  python3 - <<PYEOF
import json, sys

pre  = json.load(open("${PRE}"))
post = json.load(open("${POST}"))

errors = []

# rolled_back_from in post must match release_tag in pre
if post.get("rolled_back_from") != pre.get("release_tag"):
    errors.append(
        f"rolled_back_from mismatch: post={post.get('rolled_back_from')} pre={pre.get('release_tag')}"
    )

# rolled_back_to in post must match previous_tag in pre
if post.get("rolled_back_to") != pre.get("previous_tag"):
    errors.append(
        f"rolled_back_to mismatch: post={post.get('rolled_back_to')} pre={pre.get('previous_tag')}"
    )

# env must be consistent
if pre.get("env") != post.get("env"):
    errors.append(f"env mismatch: pre={pre.get('env')} post={post.get('env')}")

if errors:
    for e in errors:
        print(f"\033[0;31m[fail]\033[0m   {e}")
    sys.exit(1)

print("\033[0;32m[pass]\033[0m   Pre/post snapshot fields are consistent")
PYEOF
  [[ $? -eq 0 ]] || ((ERRORS++)) || true
fi

# ── 4. Log completeness ───────────────────────────────────────────────────────
LOG="${DRILL_DIR}/drill.log"
if [[ -f "${LOG}" ]]; then
  log "Checking drill log completeness..."
  for marker in \
    "Phase 0" "Phase 1" "Phase 2" "Phase 3" \
    "Phase 4" "Phase 5" "Phase 6" "Drill complete"
  do
    if grep -q "${marker}" "${LOG}"; then
      ok "Log contains '${marker}'"
    else
      fail "Log missing '${marker}'"
      ((ERRORS++)) || true
    fi
  done
fi

# ── Result ────────────────────────────────────────────────────────────────────
echo ""
if [[ $ERRORS -eq 0 ]]; then
  ok "All artifact checks passed for drill: $(basename "${DRILL_DIR}")"
  exit 0
else
  fail "${ERRORS} artifact check(s) failed for drill: $(basename "${DRILL_DIR}")"
  exit 1
fi
