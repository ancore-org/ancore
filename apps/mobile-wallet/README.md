# Ancore Mobile Wallet

React Native mobile wallet application for the Ancore ecosystem.

**Agent / contributor guide:** [AGENTS.md](./AGENTS.md) (modeled on [Freighter Mobile AGENTS.md](https://github.com/stellar/freighter-mobile/blob/main/AGENTS.md)).

## Features

- **Account Management**: Create, import, and recover Stellar accounts
- **Transaction History**: Paginated transaction history with indexer integration
- **Secure Storage**: Encrypted key storage with biometric authentication
- **Natural Language Transactions**: AI-powered intent parsing for intuitive transfers

## Setup

### Prerequisites

- Node.js 18+
- Expo CLI
- iOS Simulator (macOS) or Android Emulator

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start development server
pnpm dev
```

### Environment Variables

All API URLs must be read from the centralized config module (`loadMobileWalletEnvironment` / `loadMobileWalletEnvironmentFromEnv`). Copy `.env.example` to `.env` and set:

```bash
# Required
ANCORE_ACCOUNT_CONTRACT_ID=your_contract_id_here
EXPO_PUBLIC_INDEXER_URL=http://localhost:3000
EXPO_PUBLIC_RELAYER_URL=http://localhost:3001

# Optional
EXPO_PUBLIC_AI_AGENT_URL=http://localhost:3002
WALLETCONNECT_PROJECT_ID=your_project_id_here
```

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

### Services

- `accounts/` - Account management and key storage
- `security/` - Encryption and authentication
- `storage/` - Secure persistent storage (Keychain in production, in-memory under tests — see [docs/secure-storage.md](./docs/secure-storage.md))
- `sdk/` - Stellar SDK integration

## Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## License

Apache-2.0 OR MIT
