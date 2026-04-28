# @ancore/account-abstraction

Account abstraction primitives for the Ancore platform on Stellar/Soroban.

## Features

- **AccountContract**: High-level client for interacting with Ancore smart accounts
- **Event Decoders**: Typed event parsing utilities for contract events
- **XDR Utilities**: Encoding/decoding helpers for contract arguments
- **Error Handling**: Structured error types with clear messages
- **Session Keys**: Support for temporary authorization keys

## Installation

```bash
pnpm add @ancore/account-abstraction
```

## Usage

### Event Decoding

The package provides canonical typed event decoders to ensure consistent event parsing across all surfaces (dashboard, mobile, services).

#### Decoding Contract Events

```typescript
import {
  decodeAccountContractEvent,
  type DecodedAccountContractEventEnvelope
} from '@ancore/account-abstraction';
import { xdr } from '@stellar/stellar-sdk';

// From a Stellar transaction result
const contractEvent: xdr.ContractEvent = /* ... */;

const decoded = decodeAccountContractEvent(contractEvent);

if (decoded) {
  console.log('Contract ID:', decoded.contractId);

  switch (decoded.event.type) {
    case 'initialized':
      console.log('Owner:', decoded.event.owner);
      break;
    case 'executed':
      console.log('To:', decoded.event.to);
      console.log('Function:', decoded.event.functionName);
      console.log('Nonce:', decoded.event.nonce);
      break;
    case 'session_key_added':
      console.log('Public Key:', decoded.event.publicKey);
      console.log('Expires At:', decoded.event.expiresAt);
      break;
    // ... handle other event types
  }
}
```

#### Event Types

All event types are discriminated unions with a `type` field:

```typescript
type AccountContractEvent =
  | AccountContractInitializedEvent
  | AccountContractExecutedEvent
  | AccountContractSessionKeyAddedEvent
  | AccountContractSessionKeyRevokedEvent
  | AccountContractUpgradedEvent
  | AccountContractMigratedEvent
  | AccountContractSessionKeyTtlRefreshedEvent;
```

#### Event Topics

Event topic constants are available for filtering:

```typescript
import { ACCOUNT_CONTRACT_EVENT_TOPICS } from '@ancore/account-abstraction';

console.log(ACCOUNT_CONTRACT_EVENT_TOPICS.initialized); // 'initialized'
console.log(ACCOUNT_CONTRACT_EVENT_TOPICS.executed); // 'executed'
console.log(ACCOUNT_CONTRACT_EVENT_TOPICS.sessionKeyAdded); // 'session_key_added'
console.log(ACCOUNT_CONTRACT_EVENT_TOPICS.sessionKeyRevoked); // 'session_key_revoked'
console.log(ACCOUNT_CONTRACT_EVENT_TOPICS.upgraded); // 'upgraded'
console.log(ACCOUNT_CONTRACT_EVENT_TOPICS.migrated); // 'migrated'
console.log(ACCOUNT_CONTRACT_EVENT_TOPICS.sessionKeyTtlRefreshed); // 'session_key_ttl_refreshed'
```

### AccountContract Client

```typescript
import { AccountContract } from '@ancore/account-abstraction';
import { Keypair } from '@stellar/stellar-sdk';

const owner = Keypair.random();
const accountContract = new AccountContract({
  contractId: 'CAAAAAAA...',
  networkPassphrase: 'Test SDF Network ; September 2015',
  rpcUrl: 'https://soroban-testnet.stellar.org',
});

// Initialize account
await accountContract.initialize(owner.publicKey());

// Execute transaction
const result = await accountContract.execute({
  to: 'CBBBBBB...',
  functionName: 'transfer',
  args: [
    /* ... */
  ],
  expectedNonce: 0,
});

// Add session key
await accountContract.addSessionKey({
  publicKey: sessionKeypair.publicKey(),
  expiresAt: Date.now() + 86400000, // 24 hours
  permissions: [1], // PERMISSION_EXECUTE
});
```

### Error Handling

```typescript
import {
  AccountContractError,
  UnauthorizedError,
  InvalidNonceError,
  mapContractError,
} from '@ancore/account-abstraction';

try {
  await accountContract.execute(/* ... */);
} catch (error) {
  const contractError = mapContractError(error);

  if (contractError instanceof UnauthorizedError) {
    console.error('Not authorized to perform this action');
  } else if (contractError instanceof InvalidNonceError) {
    console.error('Invalid nonce - transaction may have been replayed');
  }
}
```

## Event Schema Reference

### initialized

Emitted when an account is initialized with an owner.

```typescript
interface AccountContractInitializedEvent {
  type: 'initialized';
  owner: string; // Stellar address (G...)
}
```

### executed

Emitted when a transaction is executed through the account.

```typescript
interface AccountContractExecutedEvent {
  type: 'executed';
  to: string; // Target contract address (C...)
  functionName: string; // Function name being called
  nonce: number; // Nonce used (pre-increment value)
}
```

### session_key_added

Emitted when a session key is added to the account.

```typescript
interface AccountContractSessionKeyAddedEvent {
  type: 'session_key_added';
  publicKey: string; // Ed25519 public key (G...)
  expiresAt: number; // Unix timestamp (seconds or milliseconds)
}
```

### session_key_revoked

Emitted when a session key is revoked.

```typescript
interface AccountContractSessionKeyRevokedEvent {
  type: 'session_key_revoked';
  publicKey: string; // Ed25519 public key (G...)
}
```

### upgraded

Emitted when the contract WASM is upgraded.

```typescript
interface AccountContractUpgradedEvent {
  type: 'upgraded';
  wasmHash: string; // Hex-encoded WASM hash
}
```

### migrated

Emitted when a contract migration is completed.

```typescript
interface AccountContractMigratedEvent {
  type: 'migrated';
  oldVersion: number;
  newVersion: number;
}
```

### session_key_ttl_refreshed

Emitted when a session key's TTL is refreshed.

```typescript
interface AccountContractSessionKeyTtlRefreshedEvent {
  type: 'session_key_ttl_refreshed';
  publicKey: string; // Ed25519 public key (G...)
  expiresAt: number; // Unix timestamp (seconds or milliseconds)
}
```

## Benefits

### Consistency

- Single source of truth for event schemas
- Type-safe event parsing across all surfaces
- Prevents schema drift between frontend and backend

### Reliability

- Comprehensive test coverage
- Validated against contract event emissions
- Handles edge cases (malformed data, missing fields)

### Developer Experience

- Full TypeScript support with discriminated unions
- Clear error messages for invalid data
- IDE autocomplete for event types and fields

## Integration Examples

### Dashboard Event Listener

```typescript
import { decodeAccountContractEvent } from '@ancore/account-abstraction';

async function watchAccountEvents(contractId: string) {
  const events = await stellar.getEvents({
    contractIds: [contractId],
  });

  for (const event of events) {
    const decoded = decodeAccountContractEvent(event.contractEvent);

    if (decoded?.event.type === 'executed') {
      updateTransactionHistory({
        to: decoded.event.to,
        function: decoded.event.functionName,
        nonce: decoded.event.nonce,
      });
    }
  }
}
```

### Indexer Service

```typescript
import { decodeAccountContractEvent } from '@ancore/account-abstraction';

async function indexContractEvents(ledger: Ledger) {
  for (const tx of ledger.transactions) {
    for (const event of tx.events) {
      const decoded = decodeAccountContractEvent(event);

      if (decoded) {
        await db.events.insert({
          contractId: decoded.contractId,
          type: decoded.event.type,
          data: decoded.event,
          ledger: ledger.sequence,
        });
      }
    }
  }
}
```

### Mobile Wallet Notifications

```typescript
import { decodeAccountContractEvent } from '@ancore/account-abstraction';

function processEventNotification(event: xdr.ContractEvent) {
  const decoded = decodeAccountContractEvent(event);

  if (decoded?.event.type === 'session_key_added') {
    showNotification({
      title: 'Session Key Added',
      message: `New session key expires at ${new Date(decoded.event.expiresAt)}`,
    });
  }
}
```

## Testing

```bash
pnpm test
```

## License

Apache-2.0
