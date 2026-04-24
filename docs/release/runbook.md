# Release Runbook

Step-by-step guide for cutting an Ancore release and operating the release gate.

---

## Prerequisites

- Write access to the `ancore` repository
- Member of `@ancore/core-team`
- Local toolchain: `node ≥ 20`, `pnpm ≥ 9`, `rust stable`, `stellar-cli`

---

## 0. MVP Gate (first production release only)

Before cutting the first production release, the MVP gate must pass in addition
to the standard release checklist.

1. Open `docs/release/mvp-gate-checklist.md` and work through every section.
2. Collect all required evidence artifacts (see §8 of the checklist) and store
   them in the release artifact store.
3. Schedule the **gate review meeting** with all sign-off stakeholders (§10).
4. Record the go/no-go decision in §11 of the checklist.
5. Commit the completed checklist before proceeding to step 1 below:
   ```bash
   git add docs/release/mvp-gate-checklist.md
   git commit -m "chore(release): MVP gate sign-off for vX.Y.Z"
   git push origin main
   ```

> For subsequent releases, skip this step and use only `docs/release/checklist.md`.

---

## 1. Pre-release preparation

1. Ensure all feature branches targeting this release are merged to `main`.
2. Pull latest `main` and verify CI is green.
3. Open `docs/release/checklist.md` and reset all checkboxes to `[ ]`.
4. Work through each checklist section, checking items as they are verified.
5. Commit the updated checklist:
   ```bash
   git add docs/release/checklist.md
   git commit -m "chore(release): update checklist for vX.Y.Z"
   git push origin main
   ```

---

## 2. Tagging the release

```bash
git checkout main
git pull origin main
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

Pushing the tag triggers the `Release Gate` workflow automatically.

---

## 3. Monitoring the gate

1. Navigate to **Actions → Release Gate** in the GitHub UI.
2. Each gate job runs in parallel. The `Release Gate Summary` job collects results.
3. A summary report is written to the **GitHub Actions step summary** and uploaded
   as an artifact named `release-gate-report-vX.Y.Z` (retained 90 days).
4. The artifact contains:
   - `summary.md` — human-readable gate report
   - `result.json` — machine-readable result for downstream tooling

### Gate pass

All five gates show ✅. The `Release` workflow proceeds automatically (triggered
by the same tag).

### Gate failure

One or more gates show ❌. The release is **blocked**.

1. Identify the failing gate from the summary report.
2. Fix the root cause on `main`.
3. Delete and re-push the tag:
   ```bash
   git tag -d vX.Y.Z
   git push origin :refs/tags/vX.Y.Z
   git tag -a vX.Y.Z -m "Release vX.Y.Z"
   git push origin vX.Y.Z
   ```

---

## 4. Override policy

Manual overrides are reserved for **critical hotfixes** where waiting for a full
gate pass would cause unacceptable production impact.

### Who can approve an override

- Minimum **2 members** of `@ancore/core-team` must agree via a GitHub comment
  on the release PR or a recorded Slack thread.
- For security-gate failures, **1 member** of `@ancore/security-team` must also
  approve.

### How to apply an override

Re-run the `Release Gate` workflow via `workflow_dispatch`:

1. Go to **Actions → Release Gate → Run workflow**.
2. Enter the `override_reason` (required): a concise explanation referencing the
   incident or issue number (e.g. `"Emergency hotfix for #123 — approved by @alice @bob"`).
3. Click **Run workflow**.

The summary report will record the override reason. The gate will pass even if
individual checks failed.

### Post-override obligations

- Open a follow-up issue within **24 hours** to address the bypassed gate.
- Record the override in `docs/release/checklist.md` under **Override Log**.
- Conduct a brief post-mortem if the same gate is overridden more than once in
  a 30-day window.

---

## 5. Post-release

1. Verify the `Release` workflow completed successfully (npm publish, GitHub Release).
2. Confirm contract WASM artifacts are attached to the GitHub Release.
3. Announce the release in the project's communication channels.
4. Archive the gate report artifact for audit purposes.
5. Reset `docs/release/checklist.md` for the next release cycle.

---

## 6. Gate reference

| # | Gate | Failure action |
|---|------|----------------|
| 1 | TS Build & Tests | Fix failing tests or build errors |
| 2 | Contracts Build & Tests | Fix Rust compile/test/clippy errors |
| 3 | Security Audit | Patch or triage vulnerable dependencies |
| 4 | Observability Configs | Fix invalid Prometheus/Alertmanager YAML |
| 5 | Release Docs | Ensure all required docs exist; check BLOCKING items |

---

## 7. Contacts

| Role | Team / Handle |
|------|---------------|
| Release coordinator | `@ancore/core-team` |
| Security sign-off | `@ancore/security-team` |
| Contract sign-off | `@ancore/contract-team` |
| Infrastructure | `@ancore/infrastructure-team` |
