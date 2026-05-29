# Security & Release Compliance Matrix

**Single source of truth** for mapping security audit items, MVP gate criteria, and release checklist items.

> **Purpose:** Ensure traceability between security controls, release gates, and operational checklists. Each row represents a compliance domain with cross-references to evidence, owners, and sign-off requirements.

---

## Matrix: Security Controls → MVP Gate → Release Checklist

| # | Control Domain | Audit Checklist Section | MVP Gate Criterion | Release Checklist Item | Owner Role | Evidence Path | Status |
|---|---|---|---|---|---|---|---|
| **SEC-001** | Cryptography (AES-256-GCM) | [1) Cryptography](../security/AUDIT_CHECKLIST.md#1-cryptography) | [Ed25519 signature verification](mvp-gate-checklist.md#2-security-criteria-blocking) | [No new crypto without sign-off](checklist.md#3-security-blocking) | Security Engineer | `packages/crypto/src/encryption.ts` | ✅ |
| **SEC-002** | Key derivation (PBKDF2 100k) | [1) Cryptography](../security/AUDIT_CHECKLIST.md#1-cryptography) | [Ed25519 signature verification](mvp-gate-checklist.md#2-security-criteria-blocking) | [No new crypto without sign-off](checklist.md#3-security-blocking) | Security Engineer | `packages/crypto/src/encryption.ts` | ✅ |
| **SEC-003** | Random generation (`crypto.getRandomValues`) | [1) Cryptography](../security/AUDIT_CHECKLIST.md#1-cryptography) | [Ed25519 signature verification](mvp-gate-checklist.md#2-security-criteria-blocking) | [No new crypto without sign-off](checklist.md#3-security-blocking) | Security Engineer | `packages/crypto/src/encryption.ts` | ✅ |
| **SEC-004** | Private key encryption at rest | [2) Sensitive data storage](../security/AUDIT_CHECKLIST.md#2-sensitive-data-storage) | [All secrets via env vars](mvp-gate-checklist.md#2-security-criteria-blocking) | [No hardcoded secrets](checklist.md#3-security-blocking) | Security Engineer | `packages/core-sdk/src/storage/secure-storage-manager.ts` | ✅ |
| **SEC-005** | Sensitive data encrypted before persistence | [2) Sensitive data storage](../security/AUDIT_CHECKLIST.md#2-sensitive-data-storage) | [All secrets via env vars](mvp-gate-checklist.md#2-security-criteria-blocking) | [No hardcoded secrets](checklist.md#3-security-blocking) | Security Engineer | `packages/core-sdk/src/storage/secure-storage-manager.ts` | ✅ |
| **SEC-006** | Data cleared on uninstall | [2) Sensitive data storage](../security/AUDIT_CHECKLIST.md#2-sensitive-data-storage) | [All secrets via env vars](mvp-gate-checklist.md#2-security-criteria-blocking) | [No hardcoded secrets](checklist.md#3-security-blocking) | Security Engineer | `apps/extension-wallet/src/background/index.ts` | ⚠️ |
| **SEC-007** | No plaintext sensitive data in localStorage | [2) Sensitive data storage](../security/AUDIT_CHECKLIST.md#2-sensitive-data-storage) | [All secrets via env vars](mvp-gate-checklist.md#2-security-criteria-blocking) | [No hardcoded secrets](checklist.md#3-security-blocking) | Security Engineer | `apps/extension-wallet/src/stores/` | ⚠️ |
| **SEC-008** | Password complexity rules | [3) Authentication & session management](../security/AUDIT_CHECKLIST.md#3-authentication-session-management) | [Session key expiry enforced](mvp-gate-checklist.md#2-security-criteria-blocking) | [No new crypto without sign-off](checklist.md#3-security-blocking) | Security Engineer | `packages/crypto/src/password.ts` | ✅ |
| **SEC-009** | Auto-lock timer (inactivity) | [3) Authentication & session management](../security/AUDIT_CHECKLIST.md#3-authentication-session-management) | [Session key expiry enforced](mvp-gate-checklist.md#2-security-criteria-blocking) | [No new crypto without sign-off](checklist.md#3-security-blocking) | Security Engineer | `apps/extension-wallet/src/security/lock-manager.ts` | ✅ |
| **SEC-010** | Session timeout configurable | [3) Authentication & session management](../security/AUDIT_CHECKLIST.md#3-authentication-session-management) | [Session key expiry enforced](mvp-gate-checklist.md#2-security-criteria-blocking) | [No new crypto without sign-off](checklist.md#3-security-blocking) | Security Engineer | `apps/extension-wallet/src/config/settings.ts` | ✅ |
| **SEC-011** | Failed unlock attempt limiting | [3) Authentication & session management](../security/AUDIT_CHECKLIST.md#3-authentication-session-management) | [Session key expiry enforced](mvp-gate-checklist.md#2-security-criteria-blocking) | [No new crypto without sign-off](checklist.md#3-security-blocking) | Security Engineer | `apps/extension-wallet/src/security/biometric-lockout-manager.ts` | ✅ |
| **SEC-012** | Production-grade password verification | [3) Authentication & session management](../security/AUDIT_CHECKLIST.md#3-authentication-session-management) | [Session key expiry enforced](mvp-gate-checklist.md#2-security-criteria-blocking) | [No new crypto without sign-off](checklist.md#3-security-blocking) | Security Engineer | `apps/extension-wallet/src/background/index.ts` | ⚠️ |
| **SEC-013** | HTTPS-only endpoint enforcement | [4) Network and API security](../security/AUDIT_CHECKLIST.md#4-network-and-api-security) | [TLS enforced on all endpoints](mvp-gate-checklist.md#2-security-criteria-blocking) | [TLS enforced in production](checklist.md#3-security-blocking) | Infrastructure Engineer | `services/relayer/src/config/environment.ts` | ⚠️ |
| **SEC-014** | Certificate pinning/validation | [4) Network and API security](../security/AUDIT_CHECKLIST.md#4-network-and-api-security) | [TLS enforced on all endpoints](mvp-gate-checklist.md#2-security-criteria-blocking) | [TLS enforced in production](checklist.md#3-security-blocking) | Infrastructure Engineer | `services/relayer/src/middleware/tls.ts` | ⚠️ |
| **SEC-015** | No sensitive data in URLs | [4) Network and API security](../security/AUDIT_CHECKLIST.md#4-network-and-api-security) | [TLS enforced on all endpoints](mvp-gate-checklist.md#2-security-criteria-blocking) | [TLS enforced in production](checklist.md#3-security-blocking) | Security Engineer | `services/relayer/src/middleware/auth.ts` | ✅ |
| **SEC-016** | Rate limiting policy documented | [4) Network and API security](../security/AUDIT_CHECKLIST.md#4-network-and-api-security) | [Rate limiting configured](mvp-gate-checklist.md#2-security-criteria-blocking) | [Rate limiting enforced](checklist.md#3-security-blocking) | Infrastructure Engineer | `services/relayer/src/middleware/rate-limit.ts` | ⚠️ |
| **SEC-017** | Extension permissions justified | [5) Permissions usage (extension)](../security/AUDIT_CHECKLIST.md#5-permissions-usage-extension) | [Least privilege review](mvp-gate-checklist.md#6-ux-and-accessibility-criteria) | [Security-sensitive changes approved](checklist.md#8-approvals-blocking) | Security Engineer | `apps/extension-wallet/manifest.json` | ⚠️ |
| **SEC-018** | Dependency audit (crypto) | [6) External dependencies](../security/AUDIT_CHECKLIST.md#6-external-dependencies-security-relevant) | [`pnpm audit --audit-level=high` zero issues](mvp-gate-checklist.md#2-security-criteria-blocking) | [`pnpm audit --audit-level=high` zero issues](checklist.md#3-security-blocking) | Engineering Lead | `pnpm audit` output | ✅ |
| **SEC-019** | Dependency audit (Rust) | [6) External dependencies](../security/AUDIT_CHECKLIST.md#6-external-dependencies-security-relevant) | [`cargo audit` zero issues](mvp-gate-checklist.md#2-security-criteria-blocking) | [`cargo audit` zero issues](checklist.md#3-security-blocking) | Engineering Lead | `cargo audit` output | ✅ |
| **SEC-020** | Crypto round-trip tests | [7) Security testing scenarios](../security/AUDIT_CHECKLIST.md#7-security-testing-scenarios) | [Unit test suite passes](mvp-gate-checklist.md#5-quality-assurance-criteria-blocking) | [Unit test suite passes](checklist.md#2-testing-blocking) | Engineering Lead | `packages/crypto/__tests__/` | ✅ |
| **SEC-021** | Signature verification tests | [7) Security testing scenarios](../security/AUDIT_CHECKLIST.md#7-security-testing-scenarios) | [Unit test suite passes](mvp-gate-checklist.md#5-quality-assurance-criteria-blocking) | [Unit test suite passes](checklist.md#2-testing-blocking) | Engineering Lead | `packages/crypto/__tests__/` | ✅ |
| **SEC-022** | Session key lifecycle tests | [7) Security testing scenarios](../security/AUDIT_CHECKLIST.md#7-security-testing-scenarios) | [Integration test suite passes](mvp-gate-checklist.md#5-quality-assurance-criteria-blocking) | [Integration tests pass](checklist.md#2-testing-blocking) | Engineering Lead | `packages/core-sdk/__tests__/` | ✅ |
| **SEC-023** | Storage unlock/auto-lock tests | [7) Security testing scenarios](../security/AUDIT_CHECKLIST.md#7-security-testing-scenarios) | [Unit test suite passes](mvp-gate-checklist.md#5-quality-assurance-criteria-blocking) | [Unit test suite passes](checklist.md#2-testing-blocking) | Engineering Lead | `apps/extension-wallet/src/security/__tests__/` | ✅ |
| **SEC-024** | Failed password retry lockout tests | [7) Security testing scenarios](../security/AUDIT_CHECKLIST.md#7-security-testing-scenarios) | [Unit test suite passes](mvp-gate-checklist.md#5-quality-assurance-criteria-blocking) | [Unit test suite passes](checklist.md#2-testing-blocking) | Engineering Lead | `apps/extension-wallet/src/security/__tests__/` | ⚠️ |
| **SEC-025** | No sensitive fields in logs | [7) Security testing scenarios](../security/AUDIT_CHECKLIST.md#7-security-testing-scenarios) | [All critical error paths handled](mvp-gate-checklist.md#3-reliability-criteria-blocking) | [No TODO/FIXME introduced](checklist.md#1-code-quality-blocking) | Engineering Lead | `packages/core-sdk/src/logging/` | ⚠️ |
| **SEC-026** | Network abuse/rate-limit tests | [7) Security testing scenarios](../security/AUDIT_CHECKLIST.md#7-security-testing-scenarios) | [Rate limiting configured](mvp-gate-checklist.md#2-security-criteria-blocking) | [Rate limiting enforced](checklist.md#3-security-blocking) | Engineering Lead | `services/relayer/__tests__/` | ⚠️ |
| **SEC-027** | Hardcoded secrets scan | [8) Common vulnerability review](../security/AUDIT_CHECKLIST.md#8-common-vulnerability-review-internal) | [`pnpm audit --audit-level=high` zero issues](mvp-gate-checklist.md#2-security-criteria-blocking) | [`pnpm audit --audit-level=high` zero issues](checklist.md#3-security-blocking) | Security Engineer | Full-repo scan output | ✅ |
| **SEC-028** | Broken authentication review | [8) Common vulnerability review](../security/AUDIT_CHECKLIST.md#8-common-vulnerability-review-internal) | [Auth enforced on all endpoints](mvp-gate-checklist.md#1-functional-requirements) | [Auth enforced on all endpoints](checklist.md#3-security-blocking) | Security Engineer | Penetration test report | ⚠️ |
| **SEC-029** | Insecure storage review | [8) Common vulnerability review](../security/AUDIT_CHECKLIST.md#8-common-vulnerability-review-internal) | [All secrets via env vars](mvp-gate-checklist.md#2-security-criteria-blocking) | [No hardcoded secrets](checklist.md#3-security-blocking) | Security Engineer | Code review + test evidence | ⚠️ |
| **SEC-030** | Access control review | [8) Common vulnerability review](../security/AUDIT_CHECKLIST.md#8-common-vulnerability-review-internal) | [Auth enforced on all endpoints](mvp-gate-checklist.md#1-functional-requirements) | [Auth enforced on all endpoints](checklist.md#3-security-blocking) | Security Engineer | Contract + relayer test output | ✅ |
| **SEC-031** | Injection vulnerability review | [8) Common vulnerability review](../security/AUDIT_CHECKLIST.md#8-common-vulnerability-review-internal) | [Error responses structured](mvp-gate-checklist.md#1-functional-requirements) | [No untyped 500s](checklist.md#3-security-blocking) | Security Engineer | Relayer validation test output | ⚠️ |
| **SEC-032** | Replay/session abuse review | [8) Common vulnerability review](../security/AUDIT_CHECKLIST.md#8-common-vulnerability-review-internal) | [Nonce replay tracking implemented](mvp-gate-checklist.md#2-security-criteria-blocking) | [Nonce replay tracking tested](checklist.md#3-security-blocking) | Security Engineer | Contract test snapshots | ✅ |
| **SEC-033** | Threat model review | [9) Known issues and mitigation plan](../security/AUDIT_CHECKLIST.md#9-known-issues-and-mitigation-plan) | [Threat model reviewed](mvp-gate-checklist.md#2-security-criteria-blocking) | [Threat model reviewed](checklist.md#3-security-blocking) | Security Engineer | `docs/security/THREAT_MODEL.md` | ⚠️ |
| **SEC-034** | Incident response plan | [10) Pre-audit exit criteria](../security/AUDIT_CHECKLIST.md#10-pre-audit-exit-criteria) | [On-call rotation confirmed](mvp-gate-checklist.md#3-reliability-criteria-blocking) | [On-call rotation confirmed](checklist.md#7-deployment-readiness) | Infrastructure Engineer | `docs/ops/incident-owners-matrix.md` | ⚠️ |

---

## Legend

| Status | Meaning |
|--------|---------|
| ✅ | Complete and verified |
| ⚠️ | Partial or in progress |
| ❌ | Not started or blocked |

---

## Cross-Reference Guide

### By Document

**Security Audit Checklist** (`docs/security/AUDIT_CHECKLIST.md`)
- Detailed internal pre-audit review of crypto, storage, auth, network, permissions, dependencies, and testing.
- **Owner:** Security Engineer
- **Audience:** Internal security team, external auditors
- **Frequency:** Updated before each audit cycle

**MVP Gate Checklist** (`docs/release/mvp-gate-checklist.md`)
- Release gate criteria for MVP launch covering functional, security, reliability, performance, QA, UX, and operational readiness.
- **Owner:** Technical Lead + Security Engineer
- **Audience:** Release team, stakeholders
- **Frequency:** Updated per release cycle

**Release Checklist** (`docs/release/checklist.md`)
- General release checklist for all releases (not MVP-specific) covering code quality, testing, security, contracts, observability, documentation, deployment, and approvals.
- **Owner:** Engineering Lead
- **Audience:** Release team, all engineers
- **Frequency:** Updated per release cycle

### By Owner Role

| Role | Responsibilities | Key Documents |
|------|---|---|
| **Security Engineer** | Crypto, storage, auth, network security, vulnerability review, threat model | [AUDIT_CHECKLIST.md](../security/AUDIT_CHECKLIST.md), [MVP Gate § 2](mvp-gate-checklist.md#2-security-criteria-blocking), [Release § 3](checklist.md#3-security-blocking) |
| **Engineering Lead** | Code quality, testing, dependencies, performance | [MVP Gate § 5](mvp-gate-checklist.md#5-quality-assurance-criteria-blocking), [Release § 1-2](checklist.md#1-code-quality-blocking) |
| **Infrastructure Engineer** | Deployment, monitoring, SLOs, incident response | [MVP Gate § 7](mvp-gate-checklist.md#7-operational-readiness-criteria-blocking), [Release § 5-7](checklist.md#5-observability-blocking) |
| **Technical Lead** | Overall release readiness, approvals | [MVP Gate § 10](mvp-gate-checklist.md#10-approvals), [Release § 8](checklist.md#8-approvals-blocking) |

---

## Validation Rules

### Link Validation

All relative links in this matrix are validated by CI:

```bash
# Check all markdown links (run locally or in CI)
npm run docs:validate-links
```

**Links checked:**
- `../security/AUDIT_CHECKLIST.md#*` → `docs/security/AUDIT_CHECKLIST.md`
- `mvp-gate-checklist.md#*` → `docs/release/mvp-gate-checklist.md`
- `checklist.md#*` → `docs/release/checklist.md`
- Evidence paths (e.g., `packages/crypto/src/encryption.ts`) → file existence

### Matrix Consistency Rules

1. **No orphaned items:** Every row in the matrix must reference at least one document section.
2. **No broken links:** All cross-references must resolve to valid sections.
3. **Owner assignment:** Every row must have an assigned owner role.
4. **Status tracking:** Status must be one of `✅`, `⚠️`, `❌`.

---

## How to Update This Matrix

1. **Add a new control:** Add a row with a unique ID (e.g., `SEC-035`), fill in all columns, and ensure links are valid.
2. **Update status:** Change the status column when evidence is collected or work is completed.
3. **Link validation:** Run `npm run docs:validate-links` before committing.
4. **Review:** Have the assigned owner review and approve changes.

---

## Integration with Release Process

This matrix is referenced in:

- **CONTRIBUTING.md** → Release section links to this matrix for pre-release checklist
- **MVP Gate Review** → Stakeholders use this matrix to track compliance
- **Security Audit Prep** → Auditors use this matrix to understand control mapping

See [CONTRIBUTING.md](../../CONTRIBUTING.md#release-process) for release workflow.

---

_Last updated: 2026-05-29_
_Maintained by: Security + Engineering teams_
