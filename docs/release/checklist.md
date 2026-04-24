# Release Checklist

This file is parsed by the `Release Gate` CI workflow.
Items marked `BLOCKING` must be checked (`- [x]`) before the gate will pass.
Items without `BLOCKING` are advisory and do not fail the gate.

> Reset all checkboxes to `[ ]` at the start of each release cycle.
> Check each item as it is verified. Commit the updated file before tagging.

---

## 1. Code Quality BLOCKING

- [ ] All CI checks pass on the release commit (lint, test, build) BLOCKING
- [ ] No `TODO` / `FIXME` / `HACK` comments introduced in this release BLOCKING
- [ ] TypeScript strict-mode errors: zero BLOCKING
- [ ] Rust clippy warnings: zero (`-D warnings`) BLOCKING

## 2. Testing BLOCKING

- [ ] Unit test suite passes with zero failures BLOCKING
- [ ] Integration tests pass (relayer queue, indexer pipeline) BLOCKING
- [ ] Contract tests pass (`cargo test` in `contracts/`) BLOCKING
- [ ] Test coverage has not regressed below baseline

## 3. Security BLOCKING

- [ ] `pnpm audit --audit-level=high` reports zero high/critical vulnerabilities BLOCKING
- [ ] `cargo audit` reports zero vulnerabilities BLOCKING
- [ ] No new cryptographic primitives introduced without security-team sign-off BLOCKING
- [ ] SECURITY.md is up to date
- [ ] Threat model reviewed for any new attack surface

## 4. Smart Contracts BLOCKING

- [ ] Contract WASM builds successfully for `wasm32-unknown-unknown` BLOCKING
- [ ] Contract ABI / interface has not changed without a migration plan BLOCKING
- [ ] Contract upgrade path documented (if applicable)
- [ ] Contract audit findings addressed (if applicable)

## 5. Observability BLOCKING

- [ ] Prometheus alert rules pass `promtool check rules` BLOCKING
- [ ] Alertmanager config passes `amtool check-config` BLOCKING
- [ ] SLO definitions document (`docs/ops/slo-definitions.md`) is current BLOCKING
- [ ] Runbooks exist for all new alerts
- [ ] Grafana dashboards validated (JSON schema check)

## 6. Documentation BLOCKING

- [ ] `CONTRIBUTING.md` reflects any new development workflow changes BLOCKING
- [ ] `docs/release/runbook.md` is current for this release BLOCKING
- [ ] Public API changes documented in relevant package READMEs
- [ ] Changelog / release notes drafted

## 7. Deployment Readiness

- [ ] Database migrations reviewed and tested against a staging environment
- [ ] Environment variable changes documented in deployment runbook
- [ ] Rollback procedure documented and tested
- [ ] On-call rotation confirmed for release window

## 8. Approvals BLOCKING

- [ ] Release PR approved by `@ancore/core-team` (minimum 2 approvers) BLOCKING
- [ ] Security-sensitive changes approved by `@ancore/security-team` BLOCKING
- [ ] Release tag created from a commit on `main` (not a feature branch) BLOCKING

---

## Override Log

If a gate was bypassed via manual override, record it here:

| Date | Gate | Override Reason | Approver |
|------|------|-----------------|----------|
| <!-- YYYY-MM-DD --> | <!-- gate name --> | <!-- reason --> | <!-- @handle --> |
