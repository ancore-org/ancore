# Extension e2e test setup

Playwright tests that run against the real built extension artifact.

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 20+ |
| pnpm | 9+ |
| Chromium (via Playwright) | installed by setup step below |

## First-time setup

```bash
# From the repo root
pnpm install

# Install Playwright browsers
cd apps/extension-wallet
pnpm exec playwright install chromium --with-deps
```

## Environment variables

No secrets are needed for the smoke tests. For nightly runs against a real
testnet, set the following in your shell or CI secrets:

| Variable | Purpose | Default |
|---|---|---|
| `E2E_TESTNET_RPC` | Stellar testnet RPC URL | Friendbot default |
| `E2E_HORIZON_URL` | Horizon URL (mocked in unit send tests) | `https://horizon-testnet.stellar.org` |

## Running the tests

```bash
# From apps/extension-wallet/

# Smoke only (< 60 s — same as CI on PRs)
pnpm exec playwright test tests/e2e/lock-unlock.spec.ts

# Full suite (includes skipped specs once dependent issues ship)
pnpm exec playwright test

# Interactive UI mode
pnpm exec playwright test --ui

# Headed (watch the browser)
pnpm exec playwright test --headed
```

## Test mnemonics

Three dedicated recovery phrases are defined in
`tests/fixtures/test-mnemonics.ts`. They are safe to commit — they control
only testnet accounts funded via Friendbot and contain no real assets.

| Key | Used by |
|---|---|
| `ALPHA` | Onboarding and lock/unlock flows (primary test wallet) |
| `BRAVO` | Send flow counterparty (destination address) |
| `CHARLIE` | Allowlist / grant-access flows |

**Never use these phrases on mainnet.**

## Spec dependency map

| Spec file | Status | Unblocks after |
|---|---|---|
| `lock-unlock.spec.ts` | ✅ smoke test passing | — |
| `lock-unlock.spec.ts` (full flow) | ⏭ skipped | #764 |
| `onboarding.spec.ts` | ⏭ skipped | #764 + #768 |
| `send.spec.ts` | ⏭ skipped | #764 |
| `grant-access.spec.ts` | ⏭ skipped | #764 + #768 |

When a blocking issue merges, remove the `test.skip(...)` wrapper and fill in
any remaining `// TODO` comments in that spec.

## CI jobs

| Job | Trigger | Timeout |
|---|---|---|
| `smoke` | Every PR touching `apps/extension-wallet/**` | 3 min |
| `full` | Nightly at 02:00 UTC on `main` | 15 min |

Traces and Playwright reports are uploaded as artifacts on failure.
