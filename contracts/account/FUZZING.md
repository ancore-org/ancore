# Contract Fuzzing & Property Testing

Durable harness for `contracts/account` trust-boundary checks (ROADMAP 3.2 / #994).
Invoice fuzz targets land when that crate’s public validation surface stabilizes.

## What is covered

| Surface                                 | Mechanism             | Location                                    |
| --------------------------------------- | --------------------- | ------------------------------------------- |
| Spend policy at `add_session_key`       | cargo-fuzz + proptest | `fuzz_spend_policy`, `fuzz_add_session_key` |
| Permission vector validation            | cargo-fuzz + proptest | `fuzz_permissions`                          |
| Per-call / cumulative spend caps        | cargo-fuzz + proptest | `fuzz_spend_limits`                         |
| Execute args (nonce, expiry, allowlist) | cargo-fuzz + proptest | `fuzz_execute_args`, `fuzz_allowlist`       |
| Nonce monotonicity                      | proptest              | `tests/properties.rs`                       |
| Expired keys reject                     | proptest              | `tests/properties.rs`                       |

Pure helpers live in [`src/validation.rs`](./src/validation.rs) and are shared by the
contract implementation and the harness so fuzz findings map 1:1 to production checks.

## Prerequisites

```bash
rustup install nightly
cargo install cargo-fuzz
# Linux/macOS: clang with libFuzzer (usually via system LLVM)
```

Windows: run fuzz targets under WSL2 or CI — libFuzzer is not supported natively on MSVC.

## Property tests (stable toolchain)

From the contracts workspace:

```bash
cd contracts
cargo test -p ancore-account --test properties
cargo test -p ancore-account validation   # unit tests in src/validation.rs
```

## Running cargo-fuzz locally

```bash
cd contracts/account

# List targets
cargo +nightly fuzz list

# Run one target for 60s
cargo +nightly fuzz run fuzz_spend_limits -- -max_total_time=60

# Run add_session_key validators
cargo +nightly fuzz run fuzz_add_session_key -- -max_total_time=60
```

Corpus is stored under `fuzz/corpus/<target>/` (gitignored except `.gitkeep`).

## Reproducing a crash

CI uploads crash artifacts on failure (`fuzz-crashes-<target>-<run_id>`).

1. Download the artifact and place the crash file under `fuzz/artifacts/<target>/` or pass it directly:
   ```bash
   cargo +nightly fuzz run fuzz_spend_limits fuzz/artifacts/fuzz_spend_limits-crash-<hash>
   ```
2. Confirm it still fails locally (deterministic replay).

## Minimizing a crash

```bash
cargo +nightly fuzz tmin fuzz_spend_limits fuzz/artifacts/fuzz_spend_limits-crash-<hash>
```

`tmin` writes a minimized input; re-run the target against that file and attach both
the original and minimized inputs to the audit note.

## Linking findings into INTERNAL_AUDIT

Any confirmed crash or invariant violation must be recorded in
[`docs/security/INTERNAL_AUDIT_v0.md`](../../docs/security/INTERNAL_AUDIT_v0.md):

1. Open a finding section (severity, surface, repro steps, minimized input hash).
2. Reference the fuzz target name and CI run URL.
3. Patch in `src/validation.rs` / `src/lib.rs` with a regression test.
4. Mark the finding **Patched** and link the PR.

See the **Fuzzing program** appendix in that document.

## CI

Workflow: [`.github/workflows/contract-fuzz.yml`](../../.github/workflows/contract-fuzz.yml)

- **Schedule:** nightly 03:00 UTC — each target runs ~300s
- **Manual:** Actions → Contract Fuzz → `workflow_dispatch` (adjust seconds / single target)
- **Artifacts:** corpus (14d) and crashes (90d)

## Invoice (deferred)

`contracts/invoice` is not yet wired into this harness. When request-to-pay validation
helpers are Env-free (or a `validation` module is extracted), add:

- `contracts/invoice/fuzz/` with cargo-fuzz metadata
- matrix entries in `contract-fuzz.yml`
- property tests for amount bounds / state-machine transitions

## Related

- ROADMAP item 3.2
- Closed #833 (prior claim without targets) → #994
- [`docs/security/INTERNAL_AUDIT_v0.md`](../../docs/security/INTERNAL_AUDIT_v0.md)
