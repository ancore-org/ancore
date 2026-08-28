# Ancore Maintainers

This file defines maintainer responsibilities and decision boundaries for the repository.

## Roles

- **Core Maintainers**
  - Own release decisions, roadmap prioritization, and repository-wide standards.
  - Final reviewers for breaking API, governance, and security policy changes.
- **Security Maintainers**
  - Review security-sensitive changes in `contracts/`, `packages/crypto/`, and `packages/account-abstraction/`.
  - Own vulnerability triage and disclosure workflow.
- **Area Maintainers**
  - Own day-to-day reviews and issue triage for specific areas:
    - Wallet apps (`apps/*`)
    - SDK and shared packages (`packages/*`)
    - Services (`services/*`)

## Responsibilities

- Keep issue backlog healthy (triage weekly, close stale invalid issues).
- Ensure CI, lint, and tests stay green on default branch.
- Keep `README.md`, `CONTRIBUTING.md`, and release docs aligned with actual repository state.
- Label and scope contributor issues (`good first issue`, `help wanted`) with clear acceptance criteria.

## Maintainer Workflow

1. Triage new issues and classify severity/priority.
2. Decide whether work is maintainer-owned or contributor-friendly.
3. For contributor issues, provide clear scope and non-ambiguous acceptance criteria.
4. For risky/security-critical changes, require at least two approvals and explicit security notes.

## Escalation

- Security disclosures: follow `SECURITY.md`.
- Release blockers: track in `docs/release/mvp-gate-checklist.md`.
- Architecture changes: require RFC process in `RFC.md`.
