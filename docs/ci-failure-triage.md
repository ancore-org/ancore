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
**Artifact**: `extension-e2e-failure-artifacts` (uploaded on failure, retained 7 days), `flaky-quarantine-report-*` (uploaded when quarantine handling reports a match)

| Failure signature | Action |
|---|---|
| Playwright timeout | Check screenshots/traces in the artifact; may be a flake — re-run first |
| Browser install failure | Verify `playwright install --with-deps chromium` step succeeded |
| Build step fails before tests | Fix build errors; E2E cannot run without a built extension |
| `Quarantined flaky test matched` warning | Confirm the linked follow-up issue is active, then prioritize removing the quarantine before its expiry |

Download artifacts from the failed run's **Summary** page → **Artifacts** section.

---

## Job: Flaky Test Quarantine Registry

**Owner**: DevOps / Maintainers
**Artifact**: `flaky-quarantine-report-*` when a quarantined failure is absorbed by a wrapped test command

The quarantine registry lives at `.github/flaky-test-quarantine.json`. Every active entry must include:

- `id`: kebab-case identifier
- `area`: one of `smart-contracts`, `sdk`, `extension-wallet`, `mobile-wallet`, `web-dashboard`, `documentation`, `infrastructure`, `security`, or `other`
- `owner`: team or GitHub handle responsible for removal
- `issue`: a GitHub follow-up issue, for example `#123` or a full GitHub issue URL
- `openedOn` and `expiresOn`: quarantine window, capped by `maxQuarantineDays`
- `matchers`: stable failure signatures used by CI to recognize the known flake

Example entry:

```json
{
  "id": "extension-smoke-unlock-timeout",
  "title": "Extension smoke unlock occasionally times out in Firefox",
  "area": "extension-wallet",
  "owner": "@ancore-org/extension",
  "issue": "https://github.com/ancore-org/ancore/issues/123",
  "openedOn": "2026-04-28",
  "expiresOn": "2026-05-12",
  "matchers": ["Timeout 30000ms exceeded", "tests/e2e/lock-unlock.spec.ts"]
}
```

If a quarantined signature matches in a wrapped lane, CI posts a warning, uploads a report, labels the PR with the registry labels, and lets the run continue. Expired entries or entries without follow-up issues fail CI.

When the flake overlaps existing Stellar Wave extension work, cross-reference the current coverage issues: #263 background wallet state, #264 auth/session consistency tests, #266 send flow simulation/failure UX, and #268 home dashboard resilience.

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
5. If the failure is confirmed flaky and blocks unrelated work, open a flaky-test follow-up issue before adding a short-lived quarantine entry.
6. Fix, push, and verify CI goes green.
