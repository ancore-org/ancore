# Security Incident Response Plan

_Last updated: 2026-04-26_

This plan is the operational playbook for wallet, SDK, relayer, and contract security incidents.

## 1) Objectives

- Protect user funds and private key material.
- Contain active exploitation quickly.
- Communicate clearly with users and stakeholders.
- Recover services safely with verified fixes.
- Capture evidence and improve controls post-incident.

## 2) Incident severity matrix

| Severity | Definition | Example |
|---|---|---|
| Sev-1 (Critical) | credible risk to funds or private-key control | auth bypass, contract exploit, signing key compromise |
| Sev-2 (High) | meaningful security impact without confirmed fund loss | relayer auth bypass, broad data exposure |
| Sev-3 (Medium) | limited impact or early-stage finding | isolated account issue, partial outage with security angle |
| Sev-4 (Low) | policy/process issue with low immediate risk | missing documentation/test evidence |

## 3) Roles

- **Incident Commander (IC):** owns timeline and decisions.
- **Security Lead:** forensics, exploit analysis, containment recommendations.
- **Engineering Lead:** patch implementation, rollback/release management.
- **Comms Lead:** internal/external updates and user advisories.
- **Support Lead:** user triage and case tracking.

## 4) Response SLAs

- Sev-1: acknowledgement ≤ 15 min, active response ≤ 60 min.
- Sev-2: acknowledgement ≤ 30 min, active response ≤ 2 h.
- Sev-3: acknowledgement ≤ 4 h, response ≤ 1 business day.
- Sev-4: triage in normal backlog unless escalated.

## 5) Response workflow

1. **Detect & Triage**
   - Validate report source and impact.
   - Assign severity and open incident channel/ticket.
2. **Contain**
   - Disable vulnerable pathways (feature flag, endpoint gate, release rollback).
   - Increase monitoring and log capture.
3. **Eradicate**
   - Fix root cause, add regression tests, review adjacent code paths.
4. **Recover**
   - Roll out patched release, verify telemetry and user impact stabilization.
5. **Post-incident**
   - Publish RCA with timeline, impact, and prevention actions.

## 6) Forensic and evidence checklist

- Preserve affected logs and request traces.
- Capture commit hashes/build artifacts in effect during incident.
- Record IOC list, impacted users/assets, and confidence level.
- Keep a strict timestamped decision log.

## 7) Communication templates (minimum)

### Internal update
- What happened
- Current severity and confidence
- Immediate containment actions
- Next decision checkpoint time

### External user advisory
- What users should do now
- Whether funds/keys are believed at risk
- ETA for next update
- Known-safe versions/actions

## 8) Incident scenarios specific to this project

1. Extension unlock bypass discovered in production.
2. Session-key permission bypass or expiry check regression.
3. Dependency CVE in crypto/signing stack.
4. Relayer token replay or brute-force campaign.
5. Sensitive data unexpectedly written to plaintext storage/logs.

## 9) Pre-audit readiness actions

- Run at least one tabletop simulation for each of:
  - auth bypass
  - contract/session-key exploit
  - dependency compromise
- Validate on-call ownership and escalation paths.
- Ensure rollback/recovery runbooks are current.

## 10) Known readiness gaps

- Need formalized user-notification decision tree by severity.
- Need explicit drill evidence attached to audit packet.
- Need ownership assignment for 24/7 first response.
