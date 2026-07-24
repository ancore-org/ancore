# Contract Fuzzing & Property Testing

Continuous input-space coverage for `contracts/account`, tracking security
roadmap Phase 3.2. Complements the manual review in
[INTERNAL_AUDIT_v0.md](./INTERNAL_AUDIT_v0.md) with machine-checked
invariants.

## Layers

1. **Property tests** (`src/property_tests.rs`, run by the normal
   `cargo test` job in CI): randomized sequences checked against a parallel
   model. Covered invariants:
   - Nonce monotonicity: mixed valid/invalid owner `execute` calls —
     nonce increments by exactly one on success and is untouched on failure.
   - Expired session keys are always rejected with `SessionKeyExpired`.
   - Cumulative spend caps: stored `spent_in_window` never exceeds the
     configured limit, matches the model across window rollovers, and
     over-limit calls fail with `ExceededSpendLimit` without consuming a
     nonce.
   - Per-call spend limit boundary behavior.
   - `add_session_key` spend-policy validation matches the documented rules
     exactly (no invalid policy ever persists a key).
2. **cargo-fuzz harness** (`fuzz/`): libFuzzer targets with structured
   `arbitrary` inputs and the same invariants as panic assertions.
   - `execute_args` — owner-path execute with random nonce correctness,
     argument shapes, and ledger-time movement.
   - `add_session_key` — arbitrary registration parameters; asserts typed
     `ContractError` failures (never host errors/panics) and stored-state
     normalization.
   - `spend_limits` — random spend sequences against a cumulative window
     limit with model cross-checks.

## Running locally

```bash
rustup toolchain install nightly
cargo install --locked cargo-fuzz
cd contracts/account
cargo fuzz run execute_args        # Ctrl-C to stop
```

The fuzz crate is a standalone workspace (`fuzz/Cargo.toml` has its own
`[workspace]` table) so it never interferes with contract builds.

## CI

`.github/workflows/fuzz.yml` runs each target for 15 minutes nightly and on
`workflow_dispatch`. If a target crashes, the failing input is uploaded as a
build artifact (`fuzz-crashes-<target>`).

## Reproducing and minimizing a crash

```bash
# Reproduce
cargo fuzz run <target> fuzz/artifacts/<target>/<crash-file>

# Minimize the input
cargo fuzz tmin <target> fuzz/artifacts/<target>/<crash-file>
```

## Triage process for findings

1. Reproduce locally and minimize (above).
2. Reduce the minimized input to a deterministic regression test in
   `src/lib.rs` or `src/property_tests.rs` before fixing.
3. Fix, confirm the regression test fails before / passes after, and re-run
   the fuzz target long enough to cover the previously crashing path.
4. Record the finding and its resolution in the INTERNAL_AUDIT process
   (append to the audit document or its successor) so manual review and
   fuzz coverage stay linked.
