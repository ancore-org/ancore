# Mobile App E2E Testing

This directory centralizes Maestro e2e flows for the Ancore mobile app.

## Quick Start

```bash
# Setup environment (one-time)
bash e2e/setup.sh

# Run a single flow
maestro test e2e/flows/lock-unlock.yaml --env-file e2e/common/env.yaml

# Run all flows
maestro test e2e/flows --env-file e2e/common/env.yaml
```

## Flows

| Flow                      | Status     | AppID                   | Purpose                                           |
| ------------------------- | ---------- | ----------------------- | ------------------------------------------------- |
| `create-wallet.yaml`      | ✅ Ready   | `org.ancore.wallet.dev` | Create new wallet from recovery phrase generation |
| `import-wallet.yaml`      | ✅ Ready   | `org.ancore.wallet.dev` | Import wallet from existing recovery phrase       |
| `lock-unlock.yaml`        | ✅ Ready   | `org.ancore.wallet.dev` | Lock/unlock wallet with password                  |
| `send-payment.yaml`       | ⏳ Blocked | `org.ancore.wallet.dev` | Send NIGHT payment to recipient (no Send UI yet)  |
| `walletconnect-pair.yaml` | ✅ Ready   | `org.ancore.wallet.dev` | Pair with dApp via WalletConnect                  |
| `sign-xdr.yaml`           | ✅ Ready   | `org.ancore.wallet.dev` | Sign transaction after WalletConnect pair         |

## CI Integration

GitHub Actions workflow (`.github/workflows/mobile-app-e2e.yml`) runs nightly:

- **iOS**: macOS simulator via xcodebuild
- **Android**: emulator via Android Emulator (GHA `reactivecircle/android-emulator-runner`)
- **Artifact capture**: Screenshots on flow failure

See [.github/workflows/mobile-app-e2e.yml](../../.github/workflows/mobile-app-e2e.yml).

## Environment Variables

Test environment is defined in `e2e/common/env.yaml`:

- `E2E_TEST_WALLET_NAME` — Display name for test wallet
- `E2E_TEST_PASSWORD` — Test password (safe for CI)
- `E2E_TEST_MNEMONIC` — Test account seed phrase (Stellar testnet)
- `E2E_TEST_ADDRESS` — Derived address from mnemonic
- `E2E_RECIPIENT_ADDRESS` — Target for send-payment flow
- `E2E_RELAYER_URL` — Local relayer endpoint
- `E2E_WC_PROJECT_ID` — WalletConnect test project ID

## Debugging Locally

To debug a flow on your local device/simulator:

### iOS Simulator

```bash
# 1. Build the app (requires native Xcode project)
cd ios && xcodebuild -scheme AncoreMobile -configuration Debug -derivedDataPath build
cd ..

# 2. Run flow with verbose logging
maestro test e2e/flows/lock-unlock.yaml \
  --env-file e2e/common/env.yaml \
  --debug \
  --headless
```

### Android Emulator

```bash
# 1. Start emulator
emulator -avd Pixel_6_API_33

# 2. Build app
cd android && ./gradlew installDebugAndroidTest
cd ..

# 3. Run flow
maestro test e2e/flows/lock-unlock.yaml \
  --env-file e2e/common/env.yaml \
  --debug
```

## Blocked Flows

- **send-payment.yaml** — Vault-backed signing is implemented, but the mobile Send UI is not wired yet.

## Running in CI

The workflow is triggered on:

- **Schedule**: Nightly (00:00 UTC)
- **Manual**: Via `workflow_dispatch` input

See `.github/workflows/mobile-app-e2e.yml` for build matrix (iOS + Android, 2 matrix jobs total).

## Maintenance

### Adding a New Flow

1. Create `e2e/flows/<feature>.yaml` with appId `org.ancore.wallet.dev`
2. Test locally with `maestro test e2e/flows/<feature>.yaml --env-file e2e/common/env.yaml`
3. Add to table above with status and blockers (if any)
4. CI picks it up automatically

### Repairing a Failing Flow

1. Run locally with `--debug` flag to capture logs/screenshots
2. Compare screen hierarchy against actual app screens
3. Update element selectors (tap, assertVisible, inputText) as needed
4. Add comments noting what was repaired and why
5. Re-test locally before pushing

### Test Account Rotation

If `E2E_TEST_MNEMONIC` needs rotation:

1. Generate new testnet keypair (see [Stellar docs](https://stellar.org/developers-blog/keys-stellar))
2. Fund new address via testnet friendbot
3. Update `E2E_TEST_MNEMONIC` and `E2E_TEST_ADDRESS` in `e2e/common/env.yaml`
4. Push & CI will use new account on next run

## See Also

- [Maestro CLI docs](https://maestro.mobile/docs)
- [Mobile wallet design (Freighter reference)](../mobile-wallet/AGENTS.md)
- Ancore monorepo [wallets guide](../../docs/wallets/FREIGHTER_COMPARISON.md)
