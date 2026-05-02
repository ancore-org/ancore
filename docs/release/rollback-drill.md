# Rollback Drill — Cadence and Ownership

Rollback drills verify that the team can revert a release to the previous
version within the target RTO and that all verification artifacts are
correctly captured.

---

## Cadence

| Drill type | Frequency | Trigger |
|------------|-----------|---------|
| Scheduled dry-run | Every 2 weeks (Monday 09:00 UTC) | `rollback-drill.yml` cron |
| Pre-release live drill | Before every mainnet release | Manual `workflow_dispatch` |
| Post-incident drill | Within 5 business days of a rollback incident | Manual `workflow_dispatch` |

Dry-run drills exercise the script logic and artifact collection without
executing destructive commands (no contract redeploy, no DB migration).

Live drills run against the `rc` environment with real `DEPLOYER_SECRET`
and `DATABASE_URL` secrets configured in the repository.

---

## Ownership

| Role | Responsibility |
|------|----------------|
| `@ancore/infrastructure-team` | Schedule drills, maintain scripts, review artifacts |
| `@ancore/core-team` | Sign off on pre-release live drill results |
| `@ancore/contract-team` | Verify contract rollback step for contract-touching releases |
| On-call engineer | Execute unplanned drills during incidents |

---

## How to run a drill

### Dry-run (safe, no side effects)

```bash
./scripts/release/rollback-drill.sh \
  --env      rc \
  --release  v1.2.0 \
  --previous v1.1.0 \
  --dry-run
```

### Live drill against RC environment

```bash
export DEPLOYER_SECRET="<secret>"
export DATABASE_URL="postgres://..."
export RELAYER_HEALTH_URL="https://rc.relayer.ancore.io/health"
export INDEXER_HEALTH_URL="https://rc.indexer.ancore.io/health"

./scripts/release/rollback-drill.sh \
  --env      rc \
  --release  v1.2.0 \
  --previous v1.1.0 \
  --artifacts ./rollback-artifacts
```

### Via GitHub Actions (recommended for pre-release drills)

1. Go to **Actions → Rollback Drill → Run workflow**.
2. Fill in `release_tag`, `previous_tag`, set `dry_run=false` for a live drill.
3. Review the step summary and download the artifact.

---

## Artifact structure

Each drill produces a timestamped directory under `rollback-artifacts/`:

```
rollback-artifacts/
└── rc-v1.2.0-20240601T090000Z/
    ├── summary.json        # Machine-readable overall result + per-check results
    ├── pre-rollback.json   # State snapshot before rollback
    ├── post-rollback.json  # State snapshot after rollback
    └── drill.log           # Full console output
```

### summary.json schema

```json
{
  "drill_id":        "rc-v1.2.0-20240601T090000Z",
  "env":             "rc",
  "release_tag":     "v1.2.0",
  "previous_tag":    "v1.1.0",
  "dry_run":         true,
  "rollback_start":  "2024-06-01T09:00:05Z",
  "rollback_end":    "2024-06-01T09:00:42Z",
  "checks_passed":   9,
  "checks_failed":   0,
  "overall":         "pass",
  "checks": [
    { "check": "previous-tag-exists",    "status": "pass", "detail": "v1.1.0 found in git" },
    { "check": "contract-rollback",      "status": "pass", "detail": "deployed v1.1.0 WASM" }
  ]
}
```

---

## Verifying artifacts after a drill

```bash
# Verify the most recent drill in the default artifacts directory
./scripts/release/verify-artifacts.sh

# Verify a specific drill directory
./scripts/release/verify-artifacts.sh --drill-dir ./rollback-artifacts/rc-v1.2.0-20240601T090000Z
```

`verify-artifacts.sh` checks:
- All four required files are present
- `summary.json` is valid JSON with `overall = "pass"` and `checks_failed = 0`
- Pre/post snapshot fields are internally consistent
- Drill log contains all six phase markers

---

## Pass criteria

A drill is considered **passed** when:

1. `verify-artifacts.sh` exits 0
2. `summary.json` reports `overall: "pass"`
3. Both health checks (relayer + indexer) return HTTP 200 post-rollback
4. DB migration version did not increase after rollback (live drills only)

---

## Failure handling

| Failure | Action |
|---------|--------|
| Script error / missing artifact | Fix script, re-run drill before release |
| Health check fails post-rollback | Escalate to on-call; do not proceed with release |
| DB version did not regress | Investigate migration down-scripts; escalate to `@ancore/infrastructure-team` |
| Drill not run before release | Block release until drill passes (see `docs/release/checklist.md` §7) |

---

## Audit trail

CI artifacts are retained for **90 days**. For releases, download and attach
the drill artifact to the GitHub Release for long-term auditability.

Record each live drill in the table below:

| Date | Release | Previous | Env | Outcome | Conducted by |
|------|---------|----------|-----|---------|--------------|
| <!-- YYYY-MM-DD --> | <!-- vX.Y.Z --> | <!-- vX.Y.Z --> | <!-- rc/staging --> | <!-- pass/fail --> | <!-- @handle --> |
