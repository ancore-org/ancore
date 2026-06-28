# @ancore/stellar

Stellar and Soroban network utilities for Ancore, including `StellarClient` and resilient retry helpers for Horizon and RPC calls.

## Retry policy presets

Network calls can hit rate limits (HTTP 429) or transient failures. `@ancore/stellar` ships two presets tuned for different call sites:

| Preset    | Use case                           | Attempts | Base delay |
| --------- | ---------------------------------- | -------- | ---------- |
| `wallet`  | User-facing wallet flows (default) | 3        | 200 ms     |
| `indexer` | Background/indexer workloads       | 5        | 500 ms     |

`StellarClient` uses the conservative `wallet` preset by default. Indexer-style services can opt into the more aggressive preset when they need extra tolerance under rate limits.

## Usage

### Default wallet preset

```typescript
import { StellarClient } from '@ancore/stellar';

const client = new StellarClient({ network: 'testnet' });
```

### Indexer preset

```typescript
const indexerClient = new StellarClient({
  network: 'mainnet',
  retryPreset: 'indexer',
});
```

### Override preset values

Pass `retryOptions` to merge over the selected preset. This is useful when an app needs tighter control during rate limiting without defining a full policy from scratch.

```typescript
const client = new StellarClient({
  network: 'testnet',
  retryPreset: 'wallet',
  retryOptions: {
    maxRetries: 4,
    baseDelayMs: 300,
  },
});
```

`retryOptions` always wins over the preset for any field you provide.

### Direct retry helper usage

Presets are also exported for non-client call sites:

```typescript
import { RETRY_PRESETS, retryOptionsFromPreset, withRetry } from '@ancore/stellar';

await withRetry(() => fetchFromHorizon(), retryOptionsFromPreset(RETRY_PRESETS.indexer));
```

When all attempts are exhausted, `withRetry` throws `RetryExhaustedError` with the last underlying error attached as `lastError`.

## Installation

```bash
npm install @ancore/stellar
```
