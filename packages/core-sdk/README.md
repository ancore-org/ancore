# @ancore/core-sdk

Core SDK for building on the Ancore account abstraction layer.

## AccountTransactionBuilder

> **This is a WRAPPER, not a replacement.**
>
> `AccountTransactionBuilder` uses Stellar SDK's `TransactionBuilder` internally.
> We do **not** reimplement transaction building — we provide convenience methods
> for invoking Ancore's account abstraction smart contract.

### Why a wrapper?

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

### What it does

| Feature                                    | How                                                                                                         |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Wraps Stellar SDK's TransactionBuilder** | Constructor creates an internal `TransactionBuilder` and delegates all operations to it                     |
| **Convenience methods**                    | `.addSessionKey()`, `.revokeSessionKey()`, `.execute()` encode contract params and call `Contract.call()`   |
| **Automatic simulation**                   | `.build()` runs Soroban simulation and assembles the transaction with resource footprints & fees            |
| **Passthrough**                            | `.addOperation()` lets you add **any** standard Stellar operation alongside contract calls                  |
| **Fluent API**                             | Every method returns `this` so you can chain just like the native builder                                   |
| **Actionable errors**                      | Custom error classes (`SimulationFailedError`, `BuilderValidationError`, etc.) with human-readable messages |

### What it does NOT do

- Replace or re-implement Stellar SDK's `TransactionBuilder`
- Handle signing (use `tx.sign(keypair)` as usual)
- Handle submission (use `server.sendTransaction(tx)` as usual)
- Manage account state or nonces (that's the contract's responsibility)

## Installation

```bash
pnpm add @ancore/core-sdk
```

The package depends on `@stellar/stellar-sdk` (peer), `@ancore/types`, and
`@ancore/stellar`.

## Quick Start

```ts
import { AccountTransactionBuilder } from '@ancore/core-sdk';
import { Account, Keypair, Memo, Networks, SorobanRpc } from '@stellar/stellar-sdk';

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

### Revoking a session key

```ts
const tx = await new AccountTransactionBuilder(sourceAccount, opts)
  .revokeSessionKey(sessionKeypair.publicKey())
  .build();
```

### Executing with a session key

```ts
const tx = await new AccountTransactionBuilder(sourceAccount, opts)
  .execute(sessionKeypair.publicKey(), [paymentOp, manageDataOp])
  .build();
```

### Mixing convenience methods with standard operations

```ts
const tx = await new AccountTransactionBuilder(sourceAccount, opts)
  .addSessionKey(sessionKeypair.publicKey(), [0], expiresAt)
  .addOperation(someCustomSorobanOp) // any xdr.Operation
  .addMemo(Memo.text('mixed'))
  .build();
```

## API Reference

### `AccountTransactionBuilder`

#### Constructor

```ts
new AccountTransactionBuilder(sourceAccount: Account, options: AccountTransactionBuilderOptions)
```

| Option              | Type                | Description                                          |
| ------------------- | ------------------- | ---------------------------------------------------- |
| `server`            | `SorobanRpc.Server` | Soroban RPC server instance                          |
| `accountContractId` | `string`            | Contract ID (C…) of deployed Ancore account contract |
| `networkPassphrase` | `string`            | Network passphrase (e.g. `Networks.TESTNET`)         |
| `fee`               | `string`            | Base fee in stroops (default: `BASE_FEE`)            |
| `timeoutSeconds`    | `number`            | Transaction timeout (default: 300)                   |

#### Methods

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

```
core-sdk/src/
├── account-transaction-builder.ts  # Main wrapper class
├── contract-params.ts              # ScVal encoding helpers
├── errors.ts                       # Custom error types
├── index.ts                        # Barrel exports
└── __tests__/
    ├── builder.test.ts             # Unit tests (mocked)
    └── integration.test.ts         # Testnet integration tests
```
