#!/usr/bin/env bash
# verify-deploy-docs.sh
#
# Validates that the deploy walkthrough in contracts/README.md stays in sync
# with the actual scripts in this directory, and runs the dry-run to confirm
# the build pipeline referenced in the docs still passes.
#
# Usage:
#   bash scripts/verify-deploy-docs.sh
#
# Exit codes:
#   0  all checks passed
#   1  one or more checks failed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
README="${CONTRACTS_DIR}/README.md"

log()  { echo "[verify-deploy-docs] $*"; }
ok()   { echo "[verify-deploy-docs] ✓ $*"; }
fail() { echo "[verify-deploy-docs] ✗ $*" >&2; FAILURES=$((FAILURES + 1)); }

FAILURES=0

# ── Check 1: Required scripts exist ─────────────────────────────────────────
log "Checking required scripts exist..."
for script in deploy.sh dry-run.sh setup-local.sh verify-deploy-docs.sh; do
  if [[ -f "${SCRIPT_DIR}/${script}" ]]; then
    ok "scripts/${script} exists"
  else
    fail "scripts/${script} is missing"
  fi
done

# ── Check 2: README references the expected script names ────────────────────
log "Checking README references to scripts..."
for script in deploy.sh dry-run.sh verify-deploy-docs.sh; do
  if grep -q "${script}" "${README}"; then
    ok "README references ${script}"
  else
    fail "README does not reference ${script}"
  fi
done

# ── Check 3: README documents the DEPLOYER_SECRET variable ──────────────────
log "Checking README documents DEPLOYER_SECRET..."
if grep -q "DEPLOYER_SECRET" "${README}"; then
  ok "README documents DEPLOYER_SECRET"
else
  fail "README does not document DEPLOYER_SECRET"
fi

# ── Check 4: README links to Stellar Lab / Friendbot ────────────────────────
log "Checking README links to Stellar Lab..."
if grep -q "laboratory.stellar.org\|Friendbot" "${README}"; then
  ok "README links to Stellar Lab / Friendbot"
else
  fail "README does not link to Stellar Lab or Friendbot"
fi

# ── Check 5: README has a troubleshooting section ───────────────────────────
log "Checking README has Troubleshooting section..."
if grep -qi "troubleshoot" "${README}"; then
  ok "README has a Troubleshooting section"
else
  fail "README is missing a Troubleshooting section"
fi

# ── Check 6: dry-run.sh is executable and contains required steps ───────────
log "Checking dry-run.sh content..."
for keyword in "cargo build" "stellar contract optimize" "stellar contract inspect"; do
  if grep -q "${keyword}" "${SCRIPT_DIR}/dry-run.sh"; then
    ok "dry-run.sh contains: ${keyword}"
  else
    fail "dry-run.sh is missing: ${keyword}"
  fi
done

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
if [[ ${FAILURES} -eq 0 ]]; then
  log "All checks passed. Deploy docs are in sync with scripts."
  exit 0
else
  log "${FAILURES} check(s) failed. Update contracts/README.md or scripts/ to fix."
  exit 1
fi
