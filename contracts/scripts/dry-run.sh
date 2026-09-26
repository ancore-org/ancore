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
# `account` is a member of this workspace (see ../Cargo.toml), so cargo
# builds into the shared target/ at the workspace root, not account/target/.
WASM_PATH="target/wasm32-unknown-unknown/release/ancore_account.wasm"
OPTIMIZED_WASM="target/wasm32-unknown-unknown/release/ancore_account.optimized.wasm"
REPORT_PATH="${2:-dry-run-report.json}"
DRY_RUN_START=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# ── Helpers ──────────────────────────────────────────────────────────────────
log() { echo "[$(date -u +%H:%M:%S)] $*"; }
fail() { echo "ERROR: $*" >&2; exit "${1:-1}"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail 3 "Required tool not found: $1"
}


# macOS ships bash 3.2 (no associative arrays) and a BSD `date` with no
# millisecond format (`%3N` is a GNU extension) — both trip on the default
# toolchain here. python3 is already a safe assumption for this repo's
# scripts and is present on every CI runner, so timing goes through it
# instead of relying on GNU-only date syntax, and TIMINGS becomes five plain
# scalars instead of an associative array.
now_ms() { python3 -c 'import time; print(int(time.time() * 1000))'; }

elapsed_ms() {
  local start="$1"
  echo $(( $(now_ms) - start ))
}

# ── Preflight ────────────────────────────────────────────────────────────────
log "=== Ancore MVP Dry-Run Started ==="
log "Timestamp: $DRY_RUN_START"

require_cmd cargo
require_cmd stellar
require_cmd python3

TIMING_TEST=0
TIMING_BUILD=0
TIMING_OPTIMIZE=0
TIMING_SIZE_CHECK=0
TIMING_INSPECT=0
STEPS_PASSED=()
STEPS_FAILED=()

# ── Step 1: cargo test ───────────────────────────────────────────────────────
log ""
log "Step 1/5: Running contract tests..."
T=$(now_ms)
if cargo test --manifest-path "$CONTRACT_PATH/Cargo.toml" 2>&1; then
  TIMING_TEST=$(elapsed_ms "$T")
  log "  ✓ Tests passed in ${TIMING_TEST}ms"
  STEPS_PASSED+=("test")
else
  TIMING_TEST=$(elapsed_ms "$T")
  STEPS_FAILED+=("test")
  fail 1 "Contract tests failed"
fi

# ── Step 2: Build WASM ───────────────────────────────────────────────────────
log ""
log "Step 2/5: Building WASM artifact..."
T=$(now_ms)
if cargo build \
    --manifest-path "$CONTRACT_PATH/Cargo.toml" \
    --target wasm32-unknown-unknown \
    --release 2>&1; then
  TIMING_BUILD=$(elapsed_ms "$T")
  log "  ✓ Build succeeded in ${TIMING_BUILD}ms"
  STEPS_PASSED+=("build")
else
  TIMING_BUILD=$(elapsed_ms "$T")
  STEPS_FAILED+=("build")
  fail 1 "WASM build failed"
fi

# ── Step 3: Optimize WASM ────────────────────────────────────────────────────
log ""
log "Step 3/5: Optimizing WASM..."
T=$(now_ms)
if stellar contract optimize --wasm "$WASM_PATH" --wasm-out "$OPTIMIZED_WASM" 2>&1; then
  TIMING_OPTIMIZE=$(elapsed_ms "$T")
  log "  ✓ Optimization succeeded in ${TIMING_OPTIMIZE}ms"
  STEPS_PASSED+=("optimize")
else
  TIMING_OPTIMIZE=$(elapsed_ms "$T")
  STEPS_FAILED+=("optimize")
  fail 1 "WASM optimization failed"
fi

# ── Step 4: Size validation ──────────────────────────────────────────────────
log ""
log "Step 4/5: Validating artifact size..."
T=$(now_ms)
WASM_SIZE=$(wc -c < "$OPTIMIZED_WASM")
TIMING_SIZE_CHECK=$(elapsed_ms "$T")

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
T=$(now_ms)
if stellar contract inspect --wasm "$OPTIMIZED_WASM" 2>&1; then
  TIMING_INSPECT=$(elapsed_ms "$T")
  log "  ✓ Contract interface inspection passed in ${TIMING_INSPECT}ms"
  STEPS_PASSED+=("inspect")
else
  TIMING_INSPECT=$(elapsed_ms "$T")
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
# Guarding on array length (${#ARR[@]}, safe on bash 3.2 even when empty)
# rather than expanding "${ARR[@]}" directly: under `set -u` on bash 3.2
# (macOS's default /bin/bash) an empty array's [@] expansion is inconsistent —
# it can raise "unbound variable" or, with the `+` workaround, still emit one
# stray empty word instead of zero. bash 4+ needs none of this.
array_to_json_list() {
  local name="$1"
  local -a items=()
  eval "local len=\${#${name}[@]}"
  if [ "$len" -gt 0 ]; then
    eval "items=(\"\${${name}[@]}\")"
    printf '"%s",' "${items[@]}" | sed 's/,$//'
  fi
}

PASSED_JSON=$(array_to_json_list STEPS_PASSED)
FAILED_JSON=$(array_to_json_list STEPS_FAILED)

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
      "test": ${TIMING_TEST},
      "build": ${TIMING_BUILD},
      "optimize": ${TIMING_OPTIMIZE},
      "size_check": ${TIMING_SIZE_CHECK},
      "inspect": ${TIMING_INSPECT}
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
