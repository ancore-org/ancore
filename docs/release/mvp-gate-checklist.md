# MVP Release Gate Checklist

> **How to use:** Work through each section before cutting the MVP release tag.
> Items marked `BLOCKING` must be checked before the gate passes (same convention
> as `docs/release/checklist.md`). Record evidence artifact paths in the
> **Evidence** column. Obtain sign-offs in the [Approvals](#approvals) section.
>
> Reset all checkboxes to `[ ]` at the start of each release cycle.

---

## 1. Functional Requirements

| # | Criterion | Issue(s) | Pass Condition | Evidence | Status |
|---|-----------|----------|----------------|----------|--------|
| F1 | Smart account contract deployed and callable | — | `cargo test` passes; contract invocable on testnet | Test report | `[ ]` |
| F2 | Session key creation, use, and revocation | — | E2E flow passes; expiry enforced | E2E test log | `[ ]` |
| F3 | Relayer service accepts and processes relay requests | #290 | All 3 endpoints return correct responses; 62 unit+integration tests pass | `pnpm test` output | `[ ]` |
| F4 | Authentication and authorisation enforced on all mutating endpoints | #287, #289 | 401 returned without valid token; no unauthenticated writes possible | Penetration test report | `[ ]` |
| F5 | Error responses are structured and typed across all services | #128, #129 | No untyped 500s; all errors carry `code` + `message` | Integration test log | `[ ]` |
| F6 | Core SDK public API stable and documented | — | No breaking changes since last minor; README complete | API diff output | `[ ]` |

---

## 2. Security Criteria BLOCKING

- [ ] Security audit completed and report signed off BLOCKING
- [ ] Zero critical-severity findings open BLOCKING
- [ ] Fewer than 5 high-severity findings open (all triaged with accepted-risk notes) BLOCKING
- [ ] `pnpm audit --audit-level=high` reports zero issues BLOCKING
- [ ] `cargo audit` reports zero issues BLOCKING
- [ ] Ed25519 signature verification uses a reviewed cryptographic library (not a stub) BLOCKING
- [ ] Session key expiry enforced on-chain and validated off-chain BLOCKING
- [ ] All secrets managed via environment variables; none hardcoded in source BLOCKING
- [ ] TLS enforced on all external endpoints (no plaintext HTTP in production) BLOCKING
- [ ] Rate limiting configured on relayer and all public-facing services
- [ ] Nonce replay tracking implemented and tested
- [ ] Threat model (`docs/security/THREAT_MODEL.md`) reviewed for MVP attack surface

**Mapped issues:** #287 (auth), #289 (auth), #290 (relayer security stubs)

---

## 3. Reliability Criteria BLOCKING

- [ ] 99.9% uptime SLA demonstrated over ≥ 7-day staging run BLOCKING
- [ ] All critical error paths have explicit error handling (no unhandled promise rejections) BLOCKING
- [ ] Prometheus alert rules pass `promtool check rules` BLOCKING
- [ ] Alertmanager config passes `amtool check-config` BLOCKING
- [ ] PagerDuty (or equivalent) on-call rotation confirmed for release window BLOCKING
- [ ] Rollback procedure documented and drill completed (`docs/release/rollback-drill.md`)
- [ ] Backup and recovery procedure tested for any stateful services

---

## 4. Performance Criteria BLOCKING

| Metric | Target | Measurement Method | Result | Pass? |
|--------|--------|--------------------|--------|-------|
| API P95 response time | < 200 ms | k6 / Locust load test at 100 RPS | — | `[ ]` |
| API P99 response time | < 500 ms | Same load test | — | `[ ]` |
| Page load time (3G) | < 3 s | Lighthouse CI | — | `[ ]` |
| Relayer queue throughput | ≥ 50 jobs/s | Load test | — | `[ ]` |
| Contract invocation latency | < 5 s end-to-end | Testnet timing | — | `[ ]` |

- [ ] All performance targets in the table above met BLOCKING
- [ ] Load test run at 2× expected peak traffic with no degradation

---

## 5. Quality Assurance Criteria BLOCKING

- [ ] Unit test suite passes with zero failures BLOCKING
- [ ] Integration test suite passes with zero failures BLOCKING
- [ ] Contract test suite passes (`cargo test`) BLOCKING
- [ ] Test coverage ≥ 80% for all critical paths (relayer, account-abstraction, crypto) BLOCKING
- [ ] TypeScript strict-mode errors: zero BLOCKING
- [ ] Rust clippy warnings: zero (`-D warnings`) BLOCKING
- [ ] No open P0/P1 bugs BLOCKING
- [ ] No open P2 bugs without accepted-risk sign-off
- [ ] All PRs for this release reviewed by ≥ 2 engineers

---

## 6. UX and Accessibility Criteria

- [ ] Core user flows (create account, send, receive, session key) tested end-to-end
- [ ] Mobile responsiveness verified on iOS and Android (or emulators)
- [ ] WCAG 2.1 AA compliance verified via automated scan (axe / Lighthouse)
- [ ] No critical accessibility violations open
- [ ] Extension wallet tested on Chrome and Firefox

---

## 7. Operational Readiness Criteria BLOCKING

- [ ] Deployment runbook (`docs/release/runbook.md`) updated for MVP BLOCKING
- [ ] All environment variables documented BLOCKING
- [ ] Monitoring dashboards validated (Grafana JSON schema check) BLOCKING
- [ ] SLO definitions current (`docs/ops/slo-definitions.md`) BLOCKING
- [ ] Runbooks exist for all new alert rules
- [ ] Support documentation complete (FAQ, troubleshooting guide)
- [ ] Incident response contacts confirmed (`docs/ops/incident-owners-matrix.md`)

---

## 8. Evidence Artifacts Required

Collect the following before the gate review meeting. Store artifacts in the
release artifact store and link paths below.

| Artifact | Template | Owner | Path / Link | Collected |
|----------|----------|-------|-------------|-----------|
| Security audit report (PDF) | `docs/evidence-templates/security-audit.md` | Security Engineer | — | `[ ]` |
| Penetration test report | `docs/evidence-templates/pentest.md` | Security Engineer | — | `[ ]` |
| Performance / load test results (JSON or CSV) | `docs/evidence-templates/load-test.md` | Engineering | — | `[ ]` |
| Test coverage report (HTML) | — | Engineering | — | `[ ]` |
| Accessibility audit report | `docs/evidence-templates/accessibility.md` | UX Designer | — | `[ ]` |
| Staging uptime report (7-day) | — | Infrastructure | — | `[ ]` |
| Dependency vulnerability scan (`pnpm audit` + `cargo audit`) | — | Engineering | — | `[ ]` |

---

## 9. Criteria-to-Issue Mapping

| Criterion | Issue(s) | Notes |
|-----------|----------|-------|
| Authentication / authorisation | #287, #289 | Must be fully implemented, not stubbed |
| Relayer service endpoints | #290 | Stub signature service must be replaced |
| Error reporting and structured errors | #128, #129 | All services |
| Indexer offline/CI build reliability | #403, #404 | Build must work without hidden local setup assumptions |
| Contributor pre-commit quality checks | #405 | Lint-staged should include apps and services |
| Extension background lock/unlock handler tests | #406 | Security-sensitive state transitions need focused tests |
| Documentation drift checks | #407 | README/architecture should match on-disk layout |
| Security audit | TBD | Open tracking issue before gate review |
| Performance optimisation | TBD | Open tracking issue before gate review |

---

## 10. Approvals

All sign-offs must be recorded before the go/no-go decision.

### Engineering Review

| Role | Name | Signature / GitHub handle | Date |
|------|------|--------------------------|------|
| Technical Lead | | | |
| Senior Developer | | | |

### Security Review

| Role | Name | Signature / GitHub handle | Date |
|------|------|--------------------------|------|
| Security Engineer | | | |
| Compliance Officer | | | |

### Product Review

| Role | Name | Signature / GitHub handle | Date |
|------|------|--------------------------|------|
| Product Manager | | | |
| UX Designer | | | |

---

## 11. Go / No-Go Decision

| Decision | Date | Decided by | Notes |
|----------|------|------------|-------|
| <!-- GO / NO-GO --> | | | |

**Conditions for GO:** All `BLOCKING` items checked, all evidence artifacts
collected, all sign-offs obtained.

**Conditions for NO-GO:** Any `BLOCKING` item unchecked, any required evidence
missing, or any sign-off withheld.

---

## Override Log

If a blocking criterion is waived, record it here:

| Date | Criterion | Override Reason | Approvers |
|------|-----------|-----------------|-----------|
| <!-- YYYY-MM-DD --> | | | |
