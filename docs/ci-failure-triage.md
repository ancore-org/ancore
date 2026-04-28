# CI Failure Triage Guide

This document maps common CI failure signatures to their owners and recommended actions.

## Job: Lint

**Owner**: Frontend team  
**Artifact**: none (logs only)

| Failure signature | Action |
|---|---|
| `eslint` errors | Fix lint errors in the flagged file |
| `pnpm format:check` fails | Run `pnpm format` locally and commit the result |
| `pnpm install --frozen-lockfile` fails | `pnpm-lock.yaml` is out of sync — run `pnpm install` and commit the updated lockfile |

---

## Job: Test

**Owner**: Frontend team  
**Artifact**: none (logs only)

| Failure signature | Action |
|---|---|
| Unit test failure | Check test output, fix the failing test or the code it covers |
| `pnpm build` fails | Investigate TypeScript or bundler errors before tests even run |

---

## Job: Extension E2E Smoke

**Owner**: Extension team  
**Artifact**: `extension-e2e-failure-artifacts` (uploaded on failure, retained 7 days)

| Failure signature | Action |
|---|---|
| Playwright timeout | Check screenshots/traces in the artifact; may be a flake — re-run first |
| Browser install failure | Verify `playwright install --with-deps chromium` step succeeded |
| Build step fails before tests | Fix build errors; E2E cannot run without a built extension |

Download artifacts from the failed run's **Summary** page → **Artifacts** section.

---

## Job: Build & Test Contracts

**Owner**: Smart-contract team  
**Artifact**: `contract-failure-logs` (uploaded on failure, retained 7 days)

| Failure signature | Action |
|---|---|
| `cargo fmt --check` fails | Run `cargo fmt` inside `contracts/` and commit |
| `cargo clippy -- -D warnings` fails | Fix the Clippy warnings listed in the log |
| `cargo test` fails | Read the test output; check `contract-failure-logs` artifact for the compiled WASM |
| `stellar contract build` fails | Check Rust toolchain version; ensure `wasm32-unknown-unknown` target is added |

---

## Job: Security Audit

**Owner**: Security / DevOps  
**Artifact**: none (logs only)

| Failure signature | Action |
|---|---|
| `pnpm audit` reports vulnerabilities | Review the advisory, update the affected package, or add an exception with justification |

> This job has `continue-on-error: true` — a failure does not block merges but should be tracked.

---

## General Steps

1. Open the failed GitHub Actions run.
2. Expand the failed step to read the full error message.
3. Download any uploaded artifacts (Summary → Artifacts).
4. Reproduce locally with the same commands shown in the job.
5. Fix, push, and verify CI goes green.
