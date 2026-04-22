# @ancore/core-sdk

Core SDK for building on Ancore - the main entry point that ties together stellar client, crypto, account-abstraction, and types into a unified AncoreClient API.

## Overview

The `@ancore/core-sdk` package serves as the orchestration layer for the Ancore stack. It provides a single, unified API that consumers (extension wallet, mobile wallet) can use to interact with the full Ancore ecosystem without needing to manage multiple packages directly.

## Key Features

- **Unified API**: Single import for all Ancore functionality
- **Account Management**: Create and import smart accounts
- **Session Keys**: Add, revoke, and query session keys
- **Transaction Execution**: Execute operations with session key authorization
- **Network Abstraction**: Support for testnet, mainnet, and local networks
- **Error Handling**: Comprehensive error types with actionable messages

### AccountTransactionBuilder

Invoking Soroban smart-contract methods through the Stellar SDK requires verbose
XDR encoding and contract-invocation boilerplate. For example, adding a session
key to a smart account requires encoding the public key as an `ScVal` address,
the permissions as a `Vec<u32>`, the expiration as a `u64`, building a
`Contract.call()` operation, simulating, assembling, and finally submitting.

`AccountTransactionBuilder` collapses all of that into:

```ts
const tx = await new AccountTransactionBuilder(sourceAccount, {
  server,
  accountContractId: 'CABC...',
  networkPassphrase: Networks.TESTNET,
})
  .addSessionKey(sessionKey.publicKey(), [0, 1], expiresAt)
  .addMemo(Memo.text('Add session key'))
  .build(); // ← automatically simulates & assembles
```

#### What it does

| Feature                                    | How                                                                                                         |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Wraps Stellar SDK's TransactionBuilder** | Constructor creates an internal `TransactionBuilder` and delegates all operations to it                     |
| **Convenience methods**                    | `.addSessionKey()`, `.revokeSessionKey()`, `.execute()` encode contract params and call `Contract.call()`   |
| **Automatic simulation**                   | `.build()` runs Soroban simulation and assembles the transaction with resource footprints & fees            |
| **Passthrough**                            | `.addOperation()` lets you add **any** standard Stellar operation alongside contract calls                  |
| **Fluent API**                             | Every method returns `this` so you can chain just like the native builder                                   |
| **Actionable errors**                      | Custom error classes (`SimulationFailedError`, `BuilderValidationError`, etc.) with human-readable messages |

#### What it does NOT do

- Replace or re-implement Stellar SDK's `TransactionBuilder`
- Handle signing (use `tx.sign(keypair)` as usual)
- Handle submission (use `server.sendTransaction(tx)` as usual)
- Manage account state or nonces (that's the contract's responsibility)

## Installation

```bash
npm install @ancore/core-sdk
```

## Usage

### Basic Setup

```typescript
import { AncoreClient, SessionPermission } from '@ancore/core-sdk';

const client = new AncoreClient({ network: 'testnet' });
```

### Direct AccountTransactionBuilder Usage

```typescript
// 1. Set up Soroban RPC connection
const server = new SorobanRpc.Server('https://soroban-testnet.stellar.org');
const keypair = Keypair.fromSecret('S...');
const sourceAccount = await server.getAccount(keypair.publicKey());

// 2. Create builder
const builder = new AccountTransactionBuilder(
  new Account(sourceAccount.accountId(), sourceAccount.sequenceNumber()),
  {
    server,
    accountContractId: 'CABC...', // your deployed Ancore account contract
    networkPassphrase: Networks.TESTNET,
  }
);

// 3. Add a session key
const tx = await builder
  .addSessionKey(
    sessionKeypair.publicKey(),
    [0, 1], // SEND_PAYMENT, MANAGE_DATA
    Math.floor(Date.now() / 1000) + 3600 // 1 hour
  )
  .addMemo(Memo.text('Add session key'))
  .build();

// 4. Sign & submit (standard Stellar SDK flow)
tx.sign(keypair);
const result = await server.sendTransaction(tx);
```

### Create a New Account

```typescript
const account = await client.createAccount({
  name: 'My Wallet',
  fundWithFriendbot: true, // testnet only
});

console.log('Account created:', account.publicKey);
```

### Import an Existing Account

```typescript
const account = await client.importAccount({
  secretKey: 'SCZANGBA5YHTNYVVV4C3U252E2B6P6F5T3U6MM63WBSBZATAQI3EBTQ4',
  name: 'Imported Wallet',
});
```

### Get Account Balances

```typescript
const balances = await client.getBalances(account.publicKey);
console.log('Balances:', balances);
```

### Session Key Management

```typescript
import { SessionPermission } from '@ancore/core-sdk';

// Add a session key
const builder = await client.addSessionKey(account, {
  publicKey: sessionKeyPair.publicKey(),
  permissions: [SessionPermission.SEND_PAYMENT],
  expiresAt: Date.now() + 86400000, // 24 hours
  label: 'Mobile App Session',
});

// Build and submit the transaction
const transaction = await builder.build();
// ... sign and submit transaction

// Query session key
const sessionKey = await client.getSessionKey(account, sessionKeyPair.publicKey());
```

| Option              | Type                | Description                                          |
| ------------------- | ------------------- | ---------------------------------------------------- |
| `server`            | `SorobanRpc.Server` | Soroban RPC server instance                          |
| `accountContractId` | `string`            | Contract ID (C…) of deployed Ancore account contract |
| `networkPassphrase` | `string`            | Network passphrase (e.g. `Networks.TESTNET`)         |
| `fee`               | `string`            | Base fee in stroops (default: `BASE_FEE`)            |
| `timeoutSeconds`    | `number`            | Transaction timeout (default: 300)                   |

```typescript
const builder = await client.executeWithSessionKey(account, sessionKeyPair.publicKey(), operations);

const transaction = await builder.build();
// ... sign and submit transaction
```

## AccountTransactionBuilder API

| Method                                              | Returns                                | Description                                     |
| --------------------------------------------------- | -------------------------------------- | ----------------------------------------------- |
| `.addSessionKey(publicKey, permissions, expiresAt)` | `this`                                 | Invoke `add_session_key` on the contract        |
| `.revokeSessionKey(publicKey)`                      | `this`                                 | Invoke `revoke_session_key` on the contract     |
| `.execute(sessionKeyPublicKey, operations)`         | `this`                                 | Invoke `execute` with session key authorization |
| `.addOperation(operation)`                          | `this`                                 | Passthrough to Stellar SDK's `addOperation`     |
| `.addMemo(memo)`                                    | `this`                                 | Passthrough to Stellar SDK's `addMemo`          |
| `.setTimeout(seconds)`                              | `this`                                 | Override transaction timeout                    |
| `.simulate()`                                       | `Promise<SimulateTransactionResponse>` | Run Soroban simulation                          |
| `.build()`                                          | `Promise<Transaction>`                 | Simulate + assemble final transaction           |

### Error Types

| Error                        | Code                 | When                                          |
| ---------------------------- | -------------------- | --------------------------------------------- |
| `BuilderValidationError`     | `BUILDER_VALIDATION` | Invalid params or no operations               |
| `SimulationFailedError`      | `SIMULATION_FAILED`  | Soroban simulation returned an error          |
| `SimulationExpiredError`     | `SIMULATION_EXPIRED` | Simulation result requires ledger restoration |
| `TransactionSubmissionError` | `SUBMISSION_FAILED`  | Network submission failed                     |

### Contract Parameter Helpers

Exported for advanced use cases:

```ts
import {
  toScAddress,
  toScU64,
  toScU32,
  toScPermissionsVec,
  toScOperationsVec,
} from '@ancore/core-sdk';
```

## Testing

```bash
# Unit tests (mocked, runs offline)
pnpm test

# Integration tests (requires funded testnet account + deployed contract)
TESTNET_SECRET_KEY=S... TESTNET_CONTRACT_ID=C... pnpm test:integration
```

## Architecture

The Core SDK acts as the orchestration layer that wires together:

- **@ancore/stellar**: Network client for Stellar blockchain interactions
- **@ancore/crypto**: Cryptographic utilities for signing and verification
- **@ancore/account-abstraction**: Smart contract account abstraction layer
- **@ancore/types**: Shared TypeScript types and interfaces

## API Reference

### AncoreClient

The main client class that provides the unified API.

#### Constructor

```typescript
new AncoreClient(config: AncoreClientConfig)
```

#### Methods

- `createAccount(options?)`: Create a new smart account
- `importAccount(options)`: Import an existing account
- `getBalances(publicKey)`: Get account balances
- `accountExists(publicKey)`: Check if account exists
- `addSessionKey(account, options)`: Add a session key
- `revokeSessionKey(account, publicKey)`: Revoke a session key
- `getSessionKey(account, publicKey)`: Query a session key
- `executeWithSessionKey(account, sessionKey, operations)`: Execute operations
- `getNetwork()`: Get current network
- `getNetworkPassphrase()`: Get network passphrase
- `isNetworkHealthy()`: Check network health
- `verifySignature(message, signature, publicKey)`: Verify a signature

### Error Types

The SDK provides comprehensive error types for different failure scenarios:

- `AncoreClientError`: General client errors
- `WalletCreationError`: Account creation/import failures
- `SessionKeyError`: Session key operation failures
- `TransactionError`: Transaction execution failures
- `SimulationFailedError`: Soroban simulation failures
- `BuilderValidationError`: Transaction builder validation errors

## Development

### Running Tests

```bash
pnpm test
```

### Building

```bash
pnpm build
```

## Dependencies

This package depends on the following Ancore packages:

- `@ancore/types`: Shared types and interfaces
- `@ancore/stellar`: Stellar network client
- `@ancore/crypto`: Cryptographic utilities
- `@ancore/account-abstraction`: Account abstraction layer

## License

Apache-2.0
