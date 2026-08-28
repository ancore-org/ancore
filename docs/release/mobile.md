# Mobile wallet release

Store release engineering for `@ancore/mobile-app` (React Native host). Full
runbook: [apps/mobile-app/RELEASE.md](../../apps/mobile-app/RELEASE.md).

---

## Scope

| Platform | Track | Automation |
|----------|-------|--------------|
| iOS | TestFlight | Fastlane `ios dev` / `ios prod` |
| Android | Play internal | Fastlane `android dev` / `android prod` |

Dual bundle IDs isolate dev and prod installs:

| Variant | Bundle ID |
|---------|-----------|
| Dev | `org.ancore.wallet.dev` |
| Prod | `org.ancore.wallet` |

---

## Triggering a release

**Automatic (recommended):** push a mobile tag:

```bash
git tag -a mobile-v0.2.0 -m "Mobile release v0.2.0"
git push origin mobile-v0.2.0
```

**Manual:** Actions → **Mobile App Release** → Run workflow.

| Input | Default | Notes |
|-------|---------|-------|
| `ref_name` | current ref | Tag, branch, or SHA |
| `build_env` | `dev` (manual) / `prod` (tag) | `dev` or `prod` flavor/scheme |
| `upload_to_testflight` | `yes` | Set `no` for build-only |
| `upload_to_google_play` | `yes` | Set `no` for build-only |

---

## Pre-release checklist (mobile-specific)

Add to the main [release checklist](./checklist.md) for mobile cuts:

- [ ] `node apps/mobile-app/scripts/set-app-version.mjs X.Y.Z` run and committed
- [ ] Maestro e2e flows pass on dev build locally or in CI
- [ ] App Store Connect / Play Console listings updated if needed
- [ ] CI secrets and variables configured (see RELEASE.md)
- [ ] TestFlight / internal testers notified

---

## Emergency hotfix procedure

1. Branch from the **last shipped mobile tag**, not `main`:
   ```bash
   git checkout -b emergency/mobile-v0.1.1 mobile-v0.1.0
   ```
2. Cherry-pick or commit the fix; bump patch version with `set-app-version.mjs`.
3. QA via manual workflow dispatch (`build_env=dev`) before prod tag.
4. Tag `mobile-vX.Y.Z` and monitor **Mobile App Release**.
5. Merge hotfix back to `main` via PR to avoid drift.

---

## Version sync

Marketing version (`X.Y.Z`) is synced by `apps/mobile-app/scripts/set-app-version.mjs`
across `package.json`, Gradle `versionName`, and iOS `MARKETING_VERSION` /
`CFBundleShortVersionString`.

Build number (`versionCode` / `CURRENT_PROJECT_VERSION`) is set at CI time from
`GITHUB_RUN_NUMBER` via Fastlane.

---

## Related docs

- [apps/mobile-app/RELEASE.md](../../apps/mobile-app/RELEASE.md) — detailed runbook
- [Release runbook](./runbook.md) — monorepo-wide release gate
- [FREIGHTER_COMPARISON.md](../wallets/FREIGHTER_COMPARISON.md) §6.1 — parity target
