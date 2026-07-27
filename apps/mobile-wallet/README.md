# Ancore Mobile Wallet

`@ancore/mobile-wallet` is a **TypeScript library** — screens, hooks, security
primitives, and storage adapters for the Ancore mobile wallet. It is built
with `tsc`, has no dev server, and is not runnable on its own. The runnable
React Native app that embeds this library lives at
[`apps/mobile-app`](../mobile-app) (`OnboardingNavigator` from this package
is its entry screen).

**Agent / contributor guide:** [AGENTS.md](./AGENTS.md) (modeled on [Freighter Mobile AGENTS.md](https://github.com/stellar/freighter-mobile/blob/main/AGENTS.md)).

## Features

- **Account Management**: Create, import, and recover Stellar accounts
- **Transaction History**: Paginated transaction history with indexer integration
- **Secure Storage**: Encrypted key storage with biometric authentication
- **WalletConnect v2**: Session approval and Stellar RPC handling via `@reown/walletkit`
- **Natural Language Transactions**: AI-powered intent parsing for intuitive transfers

## What this package exports

See [`src/index.ts`](./src/index.ts) for the full surface. The main groups:

| Export area                                        | Examples                                                            |
| ---------------------------------------------------- | --------------------------------------------------------------------- |
| Navigation                                          | `OnboardingNavigator`, `OnboardingNavigatorTestHarness`              |
| Screens                                             | `HistoryScreen`, `WCPairingScreen`                                   |
| Config                                              | `loadMobileWalletEnvironment`, `loadMobileWalletEnvironmentFromEnv`, `resolveServiceUrls` |
| Security                                            | Biometric adapters, `MobileSecureVault`, lockout manager (`./src/security`) |
| Storage                                             | Keychain-backed secure store adapter (`./src/storage`)               |
| WalletConnect                                       | `WalletKitProvider`, `useWalletConnect`, `createStellarRpcHandlers`, `SessionApprovalSheet`, `SignAuthEntryApprovalSheet` |
| Accounts / SDK                                      | `./src/accounts`, `./src/sdk`                                        |

Host apps (currently `apps/mobile-app`) import from `@ancore/mobile-wallet`
and provide the React Native shell, native modules, and build config.

## Setup (building/testing the library)

### Prerequisites

- Node.js 20+
- pnpm 9 (via `corepack`)

### Installation

```bash
# From the monorepo root
corepack pnpm install

# Build the library (tsc -> dist/)
corepack pnpm --filter @ancore/mobile-wallet build

# Watch mode
corepack pnpm --filter @ancore/mobile-wallet dev
```

There is no `.env` file for this package — it takes configuration as a plain
object, not by reading environment files (see below).

## Running the app

This package cannot be run by itself. To launch the wallet on a simulator/emulator, use the `apps/mobile-app` host app — see [apps/mobile-app/README.md](../mobile-app/README.md) for prerequisites (Xcode/CocoaPods, Android Studio) and commands:

```bash
corepack pnpm --filter @ancore/mobile-app ios
corepack pnpm --filter @ancore/mobile-app android
```

## Environment Variables

This library does not read `.env` files directly. Config is loaded via
`loadMobileWalletEnvironment` / `loadMobileWalletEnvironmentFromEnv`, which
validate and normalize values passed in by the host app. `apps/mobile-app`
owns the actual `.env` file — see [`apps/mobile-app/.env.example`](../mobile-app/.env.example)
for the variables it injects (`ANCORE_ACCOUNT_CONTRACT_ID`, `ANCORE_INDEXER_URL`,
`ANCORE_RELAYER_URL`, `WALLETCONNECT_PROJECT_ID`, etc).

Invalid URLs fail fast at bootstrap with a clear error message (parity with extension wallet startup validation).

## Transaction History

The mobile wallet uses a paginated transaction history hook that fetches data from the indexer REST API.

### Usage Example

```typescript
import { bootstrapMobileWallet } from '@ancore/mobile-wallet';
import { createIndexerActivityAdapter } from './screens/history/indexerActivityAdapter';
import { usePaginatedTransactionHistory } from './screens/history/usePaginatedTransactionHistory';

function HistoryScreen() {
  const bootstrap = bootstrapMobileWallet({
    ANCORE_ACCOUNT_CONTRACT_ID: process.env.ANCORE_ACCOUNT_CONTRACT_ID!,
    EXPO_PUBLIC_INDEXER_URL: process.env.EXPO_PUBLIC_INDEXER_URL!,
    EXPO_PUBLIC_RELAYER_URL: process.env.EXPO_PUBLIC_RELAYER_URL!,
  });

  const accountId = 'GABC123...';
  const adapter = createIndexerActivityAdapter(bootstrap.environment.indexerUrl, accountId);

  const {
    items,
    hasMore,
    isLoadingInitial,
    isLoadingMore,
    error,
    loadMore,
    refresh,
  } = usePaginatedTransactionHistory({ adapter });

  if (isLoadingInitial) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorView error={error} />;
  }

  return (
    <FlatList
      data={items}
      renderItem={({ item }) => <TransactionRow transaction={item} />}
      onEndReached={loadMore}
      onRefresh={refresh}
      refreshing={isLoadingMore}
    />
  );
}
```

### Adapter Interface

The `TransactionHistoryAdapter` interface allows swapping data sources without changing the UI:

```typescript
interface TransactionHistoryAdapter {
  fetchTransactionPage(params: FetchTransactionPageParams): Promise<HistoryPage>;
}
```

**Production Implementation**: `createIndexerActivityAdapter` - Fetches from indexer REST API

**Test Implementation**: Mock adapter for unit tests

## Architecture

### Screens

- `onboarding/` - Wallet creation, import, and recovery flows
- `history/` - Transaction history with pagination
- `unlock/` - Biometric and PIN authentication
- `walletconnect/` - WalletConnect pairing UI

### Services

- `accounts/` - Account management and key storage
- `security/` - Encryption and authentication
- `storage/` - Secure persistent storage (Keychain in production, in-memory under tests — see [docs/secure-storage.md](./docs/secure-storage.md))
- `sdk/` - Stellar SDK integration
- `providers/`, `walletconnect/` - WalletConnect v2 session and RPC handling
- `components/` - Shared approval sheets (`SessionApprovalSheet`, `SignAuthEntryApprovalSheet`)

## Testing

```bash
# Run all tests (Jest, with coverage)
pnpm test

# Lint
pnpm lint

# Build + test (matches CI)
pnpm test:ci
```

### End-to-end (Maestro)

Maestro flows for onboarding, sign, and WalletConnect pairing live in
[`e2e/flows`](./e2e/flows) and are driven against the `apps/mobile-app` host
app via [`maestro.config.yaml`](./maestro.config.yaml). They are not yet
wired into CI — see [`.github/workflows/mobile-e2e.yml`](../../.github/workflows/mobile-e2e.yml),
which currently only reports that the flows are scaffolded and gated behind
the corresponding mobile issues.

## License

Apache-2.0 OR MIT
