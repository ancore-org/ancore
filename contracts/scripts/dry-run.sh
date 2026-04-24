#!/bin/bash
# MVP launch dry-run: build → optimize → simulate deploy → timing log
# Does NOT broadcast to any network. Safe to run in CI and locally.
#
# Usage:
#   bash scripts/dry-run.sh [--wasm <path>] [--output <report-path>]
#
# Exit codes:
#   0  all checks passed
#   1  build/optimize failure
#   2  size limit exceeded
#   3  missing tooling

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────────
WASM_SIZE_LIMIT_BYTES=131072        # 128 KiB — Soroban network limit
CONTRACT_PATH="account"
WASM_PATH="$CONTRACT_PATH/target/wasm32-unknown-unknown/release/ancore_account.wasm"
OPTIMIZED_WASM="$CONTRACT_PATH/target/wasm32-unknown-unknown/release/ancore_account.optimized.wasm"
REPORT_PATH="${2:-dry-run-report.json}"
DRY_RUN_START=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# ── Helpers ──────────────────────────────────────────────────────────────────
log() { echo "[$(date -u +%H:%M:%S)] $*"; }
fail() { echo "ERROR: $*" >&2; exit "${1:-1}"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail 3 "Required tool not found: $1"
}

elapsed_ms() {
  local start="$1"
  echo $(( ($(date +%s%3N) - start) ))
}

# ── Preflight ────────────────────────────────────────────────────────────────
log "=== Ancore MVP Dry-Run Started ==="
log "Timestamp: $DRY_RUN_START"

require_cmd cargo
require_cmd stellar

declare -A TIMINGS
STEPS_PASSED=()
STEPS_FAILED=()

# ── Step 1: cargo test ───────────────────────────────────────────────────────
log ""
log "Step 1/5: Running contract tests..."
T=$(date +%s%3N)
if cargo test --manifest-path "$CONTRACT_PATH/Cargo.toml" 2>&1; then
  TIMINGS[test]=$(elapsed_ms $T)
  log "  ✓ Tests passed in ${TIMINGS[test]}ms"
  STEPS_PASSED+=("test")
else
  TIMINGS[test]=$(elapsed_ms $T)
  STEPS_FAILED+=("test")
  fail 1 "Contract tests failed"
fi

# ── Step 2: Build WASM ───────────────────────────────────────────────────────
log ""
log "Step 2/5: Building WASM artifact..."
T=$(date +%s%3N)
if cargo build \
    --manifest-path "$CONTRACT_PATH/Cargo.toml" \
    --target wasm32-unknown-unknown \
    --release 2>&1; then
  TIMINGS[build]=$(elapsed_ms $T)
  log "  ✓ Build succeeded in ${TIMINGS[build]}ms"
  STEPS_PASSED+=("build")
else
  TIMINGS[build]=$(elapsed_ms $T)
  STEPS_FAILED+=("build")
  fail 1 "WASM build failed"
fi

# ── Step 3: Optimize WASM ────────────────────────────────────────────────────
log ""
log "Step 3/5: Optimizing WASM..."
T=$(date +%s%3N)
if stellar contract optimize --wasm "$WASM_PATH" --output "$OPTIMIZED_WASM" 2>&1; then
  TIMINGS[optimize]=$(elapsed_ms $T)
  log "  ✓ Optimization succeeded in ${TIMINGS[optimize]}ms"
  STEPS_PASSED+=("optimize")
else
  TIMINGS[optimize]=$(elapsed_ms $T)
  STEPS_FAILED+=("optimize")
  fail 1 "WASM optimization failed"
fi

# ── Step 4: Size validation ──────────────────────────────────────────────────
log ""
log "Step 4/5: Validating artifact size..."
T=$(date +%s%3N)
WASM_SIZE=$(wc -c < "$OPTIMIZED_WASM")
TIMINGS[size_check]=$(elapsed_ms $T)

log "  Optimized WASM size: ${WASM_SIZE} bytes (limit: ${WASM_SIZE_LIMIT_BYTES} bytes)"

if [ "$WASM_SIZE" -gt "$WASM_SIZE_LIMIT_BYTES" ]; then
  STEPS_FAILED+=("size_check")
  fail 2 "Optimized WASM (${WASM_SIZE}B) exceeds Soroban network limit (${WASM_SIZE_LIMIT_BYTES}B)"
fi
log "  ✓ Size within limit"
STEPS_PASSED+=("size_check")

# ── Step 5: Simulate deploy (inspection only, no broadcast) ──────────────────
log ""
log "Step 5/5: Inspecting contract interface (no broadcast)..."
T=$(date +%s%3N)
if stellar contract inspect --wasm "$OPTIMIZED_WASM" 2>&1; then
  TIMINGS[inspect]=$(elapsed_ms $T)
  log "  ✓ Contract interface inspection passed in ${TIMINGS[inspect]}ms"
  STEPS_PASSED+=("inspect")
else
  TIMINGS[inspect]=$(elapsed_ms $T)
  STEPS_FAILED+=("inspect")
  fail 1 "Contract inspection failed"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
DRY_RUN_END=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TOTAL_STEPS=$(( ${#STEPS_PASSED[@]} + ${#STEPS_FAILED[@]} ))

log ""
log "=== Dry-Run Complete ==="
log "  Passed: ${#STEPS_PASSED[@]}/${TOTAL_STEPS}"
log "  Failed: ${#STEPS_FAILED[@]}/${TOTAL_STEPS}"
log "  Finished: $DRY_RUN_END"

# ── Write JSON report ────────────────────────────────────────────────────────
PASSED_JSON=$(printf '"%s",' "${STEPS_PASSED[@]}" | sed 's/,$//')
FAILED_JSON=$(printf '"%s",' "${STEPS_FAILED[@]}" | sed 's/,$//')

cat > "$REPORT_PATH" <<EOF
{
  "dry_run": {
    "started_at": "$DRY_RUN_START",
    "finished_at": "$DRY_RUN_END",
    "wasm_path": "$OPTIMIZED_WASM",
    "wasm_size_bytes": $WASM_SIZE,
    "wasm_size_limit_bytes": $WASM_SIZE_LIMIT_BYTES,
    "steps_passed": [$PASSED_JSON],
    "steps_failed": [$FAILED_JSON],
    "timings_ms": {
      "test": ${TIMINGS[test]:-0},
      "build": ${TIMINGS[build]:-0},
      "optimize": ${TIMINGS[optimize]:-0},
      "size_check": ${TIMINGS[size_check]:-0},
      "inspect": ${TIMINGS[inspect]:-0}
    }
  }
}
EOF

log "  Report written to: $REPORT_PATH"
log ""

if [ ${#STEPS_FAILED[@]} -gt 0 ]; then
  log "DRY-RUN RESULT: FAIL — see report for details"
  exit 1
fi

log "DRY-RUN RESULT: PASS — safe to proceed with release tagging"
exit 0
