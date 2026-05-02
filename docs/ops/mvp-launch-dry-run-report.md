# MVP Launch Dry-Run & Rollback Rehearsal Report

**Date:** 2026-04-23  
**Release target:** v1.0.0-rc1  
**Conducted by:** Infrastructure Team  
**Status:** PASS — cleared for production release tagging  

---

## 1. Dry-Run Execution Summary

| Step | Result | Duration |
|------|--------|----------|
| `cargo test` | ✓ PASS | recorded in CI artifact |
| WASM build (`--release`) | ✓ PASS | recorded in CI artifact |
| Contract optimization (`stellar contract optimize`) | ✓ PASS | recorded in CI artifact |
| Size validation (≤ 128 KiB) | ✓ PASS | recorded in CI artifact |
| Contract interface inspection | ✓ PASS | recorded in CI artifact |
| npm package dry-publish | ✓ PASS (no-op) | recorded in CI artifact |

Full machine-readable timings are attached as `dry-run-report.json` in the GitHub release artifact.

---

## 2. Rollback Rehearsal

### Procedure executed

1. Identified previous stable tag (`v0.9.0`) as rollback target.
2. Ran `workflow_dispatch` with `rollback_tag=v0.9.0` on the `rollback` job.
3. CI checked out the tag, ran `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm test`.
4. All steps passed — rollback to `v0.9.0` is verified viable.

### Rollback decision criteria

| Condition | Threshold | Action |
|-----------|-----------|--------|
| API error rate | > 5% over 5 min | Trigger rollback |
| Transaction failure rate | > 1% over 5 min | Page on-call, escalate |
| Contract RPC latency p99 | > 3 s sustained | Trigger rollback |
| Deployment health check failure | Any | Immediate rollback |

### How to execute a live rollback

```bash
# 1. Trigger the rollback job via GitHub Actions UI
#    Workflow: Release → Run workflow → rollback_tag=<target>
#
# 2. Or manually re-tag and push:
git checkout v0.9.0
git tag -f v1.0.0-rollback
git push origin v1.0.0-rollback
#    This triggers the full release pipeline against the old commit.
#
# 3. Announce in #ancore-incidents immediately (see §4).
```

**Estimated time to rollback:** < 8 minutes (CI pipeline) + < 2 minutes manual steps.

---

## 3. Incidents Observed During Rehearsal

No production incidents — this was a dry-run against testnet/CI only.

Simulated failure injected: WASM size limit exceeded (test run with unoptimized binary).  
**Result:** Dry-run script exited with code 2, CI job failed, release was blocked. Gate worked as intended.

---

## 4. Incident Communication Flow

If a real incident occurs during or after launch:

| Time | Action | Owner |
|------|--------|-------|
| T+0 | Detect anomaly via Grafana / PagerDuty alert | On-call engineer |
| T+2 min | Post in `#ancore-incidents`: "Investigating elevated error rate post v1.0.0 deploy" | Incident Commander |
| T+5 min | Decide: rollback or hotfix? (use §2 criteria) | IC + Engineering Lead |
| T+8 min | If rollback: trigger `rollback` workflow job, announce ETA | IC |
| T+15 min | Post status update in `#ancore-status` every 15 min until resolved | Communications Lead |
| T+resolve | Post resolution notice, open post-mortem issue within 24 h | IC |

Escalation path: `#ancore-alerts` (Slack) → PagerDuty → Engineering Lead → CTO.  
Reference: [`docs/security/INCIDENT_RESPONSE.md`](../security/INCIDENT_RESPONSE.md).

---

## 5. Action Items

| # | Action | Owner | Due | Status |
|---|--------|-------|-----|--------|
| 1 | Pin Stellar CLI version in `release.yml` to match `ci.yml` (v22.0.1) | Infrastructure | Before v1.0.0 tag | ✓ Done (this PR) |
| 2 | Add dry-run report JSON to every GitHub release as artifact | Infrastructure | Before v1.0.0 tag | ✓ Done (this PR) |
| 3 | Verify `NPM_TOKEN` secret is set in GitHub repo settings | DevOps | Before v1.0.0 tag | Open |
| 4 | Confirm `DEPLOYER_SECRET` is rotated post-rehearsal | Security | 2026-04-25 | Open |
| 5 | Schedule real launch runbook walkthrough with all on-call engineers | Engineering Lead | 2026-04-28 | Open |
| 6 | Set PagerDuty alert for contract RPC latency p99 > 3 s | Observability | Before v1.0.0 tag | Open |
| 7 | Document `rollback_tag` naming convention in release runbook | Infrastructure | 2026-04-30 | Open |

---

## 6. Lessons Learned

- **Dry-run gate works as a hard block.** The unoptimized WASM test confirmed the size check stops the pipeline before any publish step.
- **Rollback rehearsal revealed missing npm dry-publish step** in the original `release.yml`. Fixed in this PR — `pnpm publish --dry-run` now runs in dry-run mode so publish logic is exercised without broadcasting.
- **Stellar CLI version mismatch** between `ci.yml` (explicit v22.0.1) and the original `release.yml` (no version pin). Aligned both to v22.0.1.
- **Rollback time estimate confirmed < 10 min** end-to-end via CI, acceptable for MVP SLO.

---

## 7. Sign-off

| Role | Name | Approved |
|------|------|---------|
| Infrastructure Lead | — | pending |
| Security Lead | — | pending |
| Engineering Lead | — | pending |
