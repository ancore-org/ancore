# Release Runbook

Step-by-step guide for cutting an Ancore release and operating the release gate.

---

## Prerequisites

- Write access to the `ancore` repository
- Member of `@ancore/core-team`
- Local toolchain: `node ≥ 20`, `pnpm ≥ 9`, `rust stable`, `stellar-cli`

---

## 1. Pre-release preparation

1. Ensure all feature branches targeting this release are merged to `main`.
2. Pull latest `main` and verify CI is green.
3. Create a release branch from `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b release/vX.Y.Z
   ```
4. Bump version in root `package.json` to `vX.Y.Z-rc.1` and synchronize workspace packages.
5. Open `docs/release/checklist.md` and reset all checkboxes to `[ ]`.
6. Work through each checklist section, checking items as they are verified.
7. Commit the updated checklist to the release branch:
   ```bash
   git add docs/release/checklist.md
   git commit -m "chore(release): update checklist for vX.Y.Z"
   git push origin release/vX.Y.Z
   ```

---

## 2. Tagging the release

```bash
git checkout release/vX.Y.Z
git pull origin release/vX.Y.Z

# Release candidate
git tag -a vX.Y.Z-rc.N -m "Release Candidate vX.Y.Z-rc.N"
git push origin vX.Y.Z-rc.N

# Final release (after RC validation)
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

Pushing the tag triggers the `Release Gate` workflow automatically.

---

## 3. Monitoring the gate

1. Navigate to **Actions → Release Gate** in the GitHub UI.
2. Each gate job runs in parallel. The `Release Gate Summary` job collects results.
3. A summary report is written to the GitHub Actions step summary and uploaded as an artifact.

### Gate pass

All gates show success. The `Release` workflow proceeds automatically.

### Gate failure

One or more gates fail. The release is blocked.

1. Identify the failing gate from the summary report.
2. Fix the root cause on the release branch.
3. Delete and re-push the tag if needed.

---

## 4. Override policy

Manual overrides are reserved for critical hotfixes where waiting for a full gate pass would cause unacceptable production impact.

- Minimum **2 members** of `@ancore/core-team` must approve.
- For security-gate failures, **1 member** of `@ancore/security-team` must also approve.
- Re-run the `Release Gate` workflow via `workflow_dispatch` with an `override_reason`.
- Record the override in `docs/release/checklist.md` under **Override Log**.

---

## 5. Post-release

1. Verify the `Release` workflow completed successfully.
2. Confirm contract WASM artifacts are attached to the GitHub Release.
3. Announce the release in the project's communication channels.
4. Reset `docs/release/checklist.md` for the next release cycle.

---

## 6. Gate reference

| # | Gate | Failure action |
|---|------|----------------|
| 1 | TS Build & Tests | Fix failing tests or build errors |
| 2 | Contracts Build & Tests | Fix Rust compile/test/clippy errors |
| 3 | Security Audit | Patch or triage vulnerable dependencies |
| 4 | Observability Configs | Fix invalid Prometheus/Alertmanager YAML |
| 5 | Release Docs | Ensure required docs exist; check BLOCKING items |
