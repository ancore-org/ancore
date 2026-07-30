# Fastlane Configuration for Ancore Mobile

This directory contains Fastlane automation for iOS and Android releases, including the **Maestro e2e test quality gate**.

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

# Full release (runs e2e gate first)
fastlane ios release
```

### Android

```bash
# Run e2e tests only
fastlane android e2e_tests

# Full release (runs e2e gate first)
fastlane android release
```

## How It Works

**Fastfile defines:**

- `e2e_tests` lane — Runs the 3 ready Maestro flows (lock-unlock, walletconnect-pair, sign-xdr)
- `release` lane — Calls `e2e_tests` first, then proceeds with build/upload

**Quality Gate:** If any e2e test fails, the release is **blocked** with error.

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
