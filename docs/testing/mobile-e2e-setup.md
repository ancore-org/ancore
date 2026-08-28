# Mobile e2e test setup

Maestro flow specs for the mobile wallet live under apps/mobile-wallet/e2e/flows and are intended for device-level validation of the highest-risk wallet journeys.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Maestro CLI installed and available on your PATH
- A development build of the mobile wallet installed on a device or simulator with bundle id `org.ancore.wallet.dev`

## Environment variables

Set these before running the flows locally or in CI.

| Variable | Required | Purpose |
| --- | --- | --- |
| `E2E_TEST_PASSWORD` | Yes | Password used to unlock and complete onboarding steps. |
| `E2E_TEST_MNEMONIC` | Yes | 12-word recovery phrase for the import-wallet flow. Never commit or share real secrets. |
| `E2E_TEST_WALLET_NAME` | Yes | Display name used in the create-wallet flow. |
| `E2E_TEST_ADDRESS` | Yes | Expected address asserted after import. |
| `E2E_RECIPIENT_ADDRESS` | Yes for send flow | Destination testnet address used by the send-payment flow. |

Use dedicated testnet-only values. Do not reuse production wallets or mainnet credentials.

## Testnet faucet

Fund the import/send test account with testnet lumens before exercising the send flow:

```bash
curl "https://friendbot.stellar.org/?addr=${E2E_TEST_ADDRESS}"
```

If your wallet uses a different network, replace the URL with the matching testnet faucet endpoint.

## Running the flows

From the repository root:

```bash
maestro test apps/mobile-wallet/e2e/flows/create-wallet.yaml
maestro test apps/mobile-wallet/e2e/flows/import-wallet.yaml
maestro test apps/mobile-wallet/e2e/flows/lock-unlock.yaml
```

The send-payment flow is scaffolded and documented for when the signing/send feature ships:

```bash
maestro test apps/mobile-wallet/e2e/flows/send-payment.yaml
```

## CI status

The mobile e2e workflow is intentionally manual-only until the onboarding and send flows are stable enough for automated execution. The `send-payment` and onboarding-driven flows are marked with TODO comments and are skipped from CI until the underlying issues ship.
