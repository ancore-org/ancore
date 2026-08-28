# Fastlane Configuration for Ancore Mobile

This directory contains Fastlane automation for iOS and Android releases —
the **Maestro e2e test quality gate**, native version syncing, and the real
build/sign/upload pipeline to TestFlight and the Play internal track. See
[`docs/release/mobile-release.md`](../docs/release/mobile-release.md) for
the full release runbook (required secrets, tagging, hotfix/rollback
procedure) — this file covers just the lanes themselves.

## Setup

```bash
# Install dependencies
cd fastlane
bundle install
```

## Release Workflow

### iOS

```bash
# Run e2e tests only
fastlane ios e2e_tests

# Sync apps/mobile-app/package.json's version into the native project
fastlane ios sync_version

# Full release: sync_version -> e2e_tests -> build -> upload to TestFlight
fastlane ios beta
# `release` is kept as an alias of `beta` for backward compatibility.

# Build and sign without uploading (still runs the real build)
fastlane ios beta dry_run:true
```

### Android

```bash
# Run e2e tests only
fastlane android e2e_tests

# Sync apps/mobile-app/package.json's version into the native project
fastlane android sync_version

# Full release: sync_version -> e2e_tests -> build -> upload to Play (internal track)
fastlane android beta
# `release` is kept as an alias of `beta` for backward compatibility.

# Build and sign without uploading (still runs the real build)
fastlane android beta dry_run:true
```

Both `beta` lanes also accept `skip_e2e:true` for a faster local iteration
loop — CI always runs the e2e gate for real.

## How It Works

**Fastfile defines, per platform:**

- `e2e_tests` — Runs the 3 ready Maestro flows (lock-unlock, walletconnect-pair, sign-xdr)
- `sync_version` — Writes `apps/mobile-app/package.json`'s version into the
  native project (see `apps/mobile-app/scripts/sync-native-version.js`)
- `beta` — `sync_version` → `e2e_tests` (unless skipped) → build & sign →
  upload to TestFlight/Play internal (unless `dry_run:true`)
- `release` — an alias of `beta`, kept so any existing tooling/muscle
  memory calling `fastlane ios release` / `fastlane android release`
  keeps working

**Quality Gate:** If any e2e test fails, the release is **blocked** with error.

**Signing:** iOS uses `match` (certs/profiles from a private git repo);
Android uses a release keystore sourced entirely from environment
variables (`ANCORE_RELEASE_STORE_FILE` etc. — see
`apps/mobile-app/android/app/build.gradle`) rather than ever falling back
to debug signing for a real release build. Both fail loudly with a clear
error if their required secrets aren't set, rather than silently
proceeding unsigned/debug-signed.

**Tests run in order:**

1. ✅ lock-unlock.yaml — Wallet unlock/lock cycle
2. ✅ walletconnect-pair.yaml — WalletConnect session pairing
3. ✅ sign-xdr.yaml — Transaction signing via WalletConnect

**Blocked flows (commented out, uncomment when ready):**

- create-wallet.yaml — Blocked by #783
- import-wallet.yaml — Blocked by #783
- send-payment.yaml — Blocked by #785

## Environment

Flows use shared test environment from `apps/mobile-app/e2e/common/env.yaml`:

- Test wallet credentials
- Relayer URL
- WalletConnect project ID

## CI Integration

The GitHub Actions workflow (`.github/workflows/mobile-app-e2e.yml`) runs:

- Nightly automated e2e tests (schedule)
- Manual dispatch for on-demand testing

Local Fastlane lanes can also be run before pushing releases, ensuring quality gate is met.

## Debugging Failures

If a release is blocked by e2e failure:

1. Identify which flow failed (Fastlane prints the flow name)
2. Run locally with debug flag:
   ```bash
   maestro test apps/mobile-app/e2e/flows/<flow>.yaml \
     --env-file apps/mobile-app/e2e/common/env.yaml \
     --debug
   ```
3. Fix selectors/assertions in the flow YAML
4. Re-run Fastlane lane to verify

## Future: Unlock More Flows

When dependencies ship:

1. Uncomment create-wallet, import-wallet, send-payment in Fastfile
2. Re-test locally
3. Commit and push
4. Next release will include full e2e suite

## Related Docs

- [Mobile E2E Testing Guide](../apps/mobile-app/e2e/README.md)
- [GitHub Actions Workflow](.github/workflows/mobile-app-e2e.yml)
