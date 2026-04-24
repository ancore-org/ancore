# SDK Wrappers

> Canonical reference for `@ancore/core-sdk` and `@ancore/account-abstraction` public APIs.  
> Machine-readable spec: [`api-reference.yaml`](./api-reference.yaml)  
> Last updated: 2026-04-24 · Issue #287

---

## Packages

| Package | Stability | Description |
|---------|-----------|-------------|
| `@ancore/core-sdk` | Public (SemVer) | High-level SDK for app developers |
| `@ancore/account-abstraction` | Public (SemVer) | Low-level contract wrapper and XDR utilities |
| `@ancore/types` | Public (SemVer) | Shared TypeScript types |

---

## Shared types

### `SessionKey` (`@ancore/types`)

```typescript
enum SessionPermission {
  SEND_PAYMENT    = 0,
  MANAGE_DATA     = 1,
  INVOKE_CONTRACT = 2,
}

interface SessionKey {
  publicKey:   string;             // G… Stellar address
  permissions: SessionPermission[];
  expiresAt:   number;             // unix milliseconds (ms) — @ancore/types definition
  // Note: the contract stores/compares in unix seconds. The SDK's TTL helper
  // auto-detects ms vs seconds (values > 100_000_000_000 treated as ms).
  label?:      string;             // off-chain label only, not stored on-chain
}
```

### `TransactionResult` (`@ancore/types`)

```typescript
interface TransactionResult {
  status:    'success' | 'failure' | 'pending';
  hash?:     string;   // present on success
  ledger?:   number;   // present on success
  error?:    string;   // present on failure
  timestamp: number;   // unix ms
}
```

### `InvocationArgs` (`@ancore/account-abstraction`)

```typescript
interface InvocationArgs {
  method: string;
  args:   xdr.ScVal[];
}
```

Returned by all builder methods. Pass to your `TransactionBuilder` to construct
the Stellar operation.

---

## Error hierarchy

```
AncoreSdkError                       (@ancore/core-sdk)
├── BuilderValidationError           BUILDER_VALIDATION
├── SimulationFailedError            SIMULATION_FAILED
├── SimulationExpiredError           SIMULATION_EXPIRED
├── TransactionSubmissionError       SUBMISSION_FAILED
├── SessionKeyManagementError        SESSION_KEY_MANAGEMENT_FAILED
├── SessionKeyExecutionValidationError  SESSION_KEY_EXECUTION_VALIDATION
└── SessionKeyExecutionError         SESSION_KEY_EXECUTION_*

AccountContractError                 (@ancore/account-abstraction)
├── AlreadyInitializedError          ALREADY_INITIALIZED
├── NotInitializedError              NOT_INITIALIZED
├── UnauthorizedError                UNAUTHORIZED
├── InvalidNonceError                INVALID_NONCE
├── SessionKeyNotFoundError          SESSION_KEY_NOT_FOUND
├── SessionKeyExpiredError           SESSION_KEY_EXPIRED
├── InsufficientPermissionError      INSUFFICIENT_PERMISSION
└── ContractInvocationError          CONTRACT_INVOCATION
```

All errors expose a `.code` string for programmatic handling.

---

## `@ancore/core-sdk`

### `AncoreClient`

High-level client. Instantiate once per account contract.

```typescript
import { AncoreClient } from '@ancore/core-sdk';

const client = new AncoreClient({ accountContractId: 'C...' });
```

**Constructor**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options.accountContractId` | `string` | ✓ | Deployed contract ID (C… address) |

Throws `BuilderValidationError` if `accountContractId` is empty.

---

#### `client.addSessionKey`

Build the `InvocationArgs` for `add_session_key`. Synchronous — does not submit.

```typescript
addSessionKey(params: AddSessionKeyParams): InvocationArgs
```

```typescript
interface AddSessionKeyParams {
  publicKey:   string;             // G… Ed25519 public key
  permissions: SessionPermission[];
  expiresAt:   number;             // unix seconds (passed to contract)
  // Note: @ancore/types SessionKey.expiresAt is unix ms — convert if reading
  // from a stored SessionKey: Math.floor(sessionKey.expiresAt / 1000)
}
```

**Validation rules**

| Field | Rule |
|-------|------|
| `publicKey` | Non-empty string |
| `permissions` | Must be an array |
| `expiresAt` | Finite number |

**Errors**

| Error | Code | Condition |
|-------|------|-----------|
| `BuilderValidationError` | `BUILDER_VALIDATION` | Any field fails validation |
| `SessionKeyManagementError` | `SESSION_KEY_MANAGEMENT_FAILED` | Unexpected error from contract layer |

**Example**

```typescript
const invocation = client.addSessionKey({
  publicKey:   'GABC...XYZ',
  permissions: [SessionPermission.SEND_PAYMENT],
  expiresAt:   Math.floor(Date.now() / 1000) + 3600, // 1 hour
});
// Pass invocation to your transaction builder
```

---

#### `client.revokeSessionKey`

Build the `InvocationArgs` for `revoke_session_key`. Synchronous — does not submit.

```typescript
revokeSessionKey(params: RevokeSessionKeyParams): InvocationArgs
```

```typescript
interface RevokeSessionKeyParams {
  publicKey: string; // G… Ed25519 public key to revoke
}
```

**Errors**

| Error | Code | Condition |
|-------|------|-----------|
| `BuilderValidationError` | `BUILDER_VALIDATION` | `publicKey` is empty |
| `SessionKeyManagementError` | `SESSION_KEY_REVOKE_FAILED` | Unexpected error from contract layer |

---

### `executeWithSessionKey` (standalone export)

> **Not a method on `AncoreClient`** (the one exported from `ancore-client.ts`).
> This is a standalone function exported from `execute-with-session-key.ts`.
> It is also available as a method on the internal `AncoreClient` class defined
> in that same file, which accepts `{ accountContract, executionLayer }`.

Execute a cross-contract call authenticated by a session key. Validates inputs,
builds the `execute` invocation, delegates to the execution layer for signing
and submission.

```typescript
import { executeWithSessionKey, type ExecuteWithSessionKeyParams } from '@ancore/core-sdk';
```

```typescript
async function executeWithSessionKey<TResult, TArgs extends readonly xdr.ScVal[]>(
  params: ExecuteWithSessionKeyParams<TArgs>
): Promise<ExecuteWithSessionKeyResult<TResult>>
```

```typescript
interface ExecuteWithSessionKeyParams<TArgs> {
  target:        string;                  // target contract address (G… or C…)
  function:      string;                  // function name on target contract
  args:          TArgs;                   // xdr.ScVal[] arguments
  expectedNonce: number;                  // current contract nonce
  signer: {
    publicKey:        string;             // session key G… address
    signAuthEntryXdr: (xdr: string) => Promise<string> | string;
  };
}

interface ExecuteWithSessionKeyResult<TResult> {
  result:           TResult;
  transactionHash?: string;
}
```

**Validation rules**

| Field | Rule |
|-------|------|
| `target` | Valid Stellar `Address` (G… or C…) |
| `function` | Non-empty string |
| `args` | Must be an array |
| `expectedNonce` | Non-negative integer |
| `signer.publicKey` | Valid Ed25519 public key |
| `signer.signAuthEntryXdr` | Must be a function |

**Errors**

| Error | Code | Condition |
|-------|------|-----------|
| `SessionKeyExecutionValidationError` | `SESSION_KEY_EXECUTION_VALIDATION` | Input validation fails |
| `SessionKeyExecutionError` | `SESSION_KEY_EXECUTION_UNAUTHORIZED` | Contract: `Unauthorized` |
| `SessionKeyExecutionError` | `SESSION_KEY_EXECUTION_INVALID_NONCE` | Contract: `InvalidNonce` |
| `SessionKeyExecutionError` | `SESSION_KEY_EXECUTION_NOT_INITIALIZED` | Contract: `NotInitialized` |
| `SessionKeyExecutionError` | `SESSION_KEY_EXECUTION_CONTRACT` | Any other `AccountContractError` |
| `SessionKeyExecutionError` | `SESSION_KEY_EXECUTION_FAILED` | Unknown error |

**Async** — returns `Promise<ExecuteWithSessionKeyResult<TResult>>`

---

### `sendPayment`

Build, sign, and submit a Stellar payment transaction.

```typescript
import { sendPayment, type SendPaymentParams, type SendPaymentDeps } from '@ancore/core-sdk';

const result = await sendPayment(params, deps);
```

```typescript
interface SendPaymentParams {
  to:      string;                                        // destination G… address
  amount:  string;                                        // decimal string e.g. "10.5000000"
  asset?:  { code: string; issuer: string } | 'native';  // default: 'native' (XLM)
  signer:  PaymentSigner;
}

interface PaymentSigner {
  sign(transactionXdr: string): Promise<string> | string;
}

interface SendPaymentDeps {
  sourceAccount:  Account;                        // loaded Stellar Account
  builderOptions: AccountTransactionBuilderOptions;
  stellarClient:  StellarClient;
}
```

**Validation rules**

| Field | Rule |
|-------|------|
| `to` | Non-empty string |
| `amount` | Positive numeric string |
| `signer` | Must implement `PaymentSigner` |

**Internal flow**

1. Validate params
2. Build `Operation.payment` with resolved asset
3. `AccountTransactionBuilder.build()` — simulate + assemble
4. `signer.sign(tx.toXDR())` — sign the assembled transaction
5. `stellarClient.submitTransaction(signedTx)` — submit to network
6. Return `TransactionResult`

**Errors**

| Error | Code | Condition |
|-------|------|-----------|
| `BuilderValidationError` | `BUILDER_VALIDATION` | Invalid params |
| `SimulationFailedError` | `SIMULATION_FAILED` | Soroban simulation error |
| `SimulationExpiredError` | `SIMULATION_EXPIRED` | Simulation requires ledger restoration |
| `TransactionSubmissionError` | `SUBMISSION_FAILED` | Signing or network submission fails |

**Returns** `Promise<TransactionResult>`

---

### `addSessionKey` (standalone)

Functional form — useful when you don't need the full `AncoreClient`.

```typescript
import { addSessionKey } from '@ancore/core-sdk';

const invocation = addSessionKey(accountContract, {
  publicKey:   'GABC...XYZ',
  permissions: [SessionPermission.SEND_PAYMENT],
  expiresAt:   Math.floor(Date.now() / 1000) + 3600,
});
```

---

### `revokeSessionKey` (standalone)

```typescript
import { revokeSessionKey } from '@ancore/core-sdk';

const invocation = revokeSessionKey(accountContract, { publicKey: 'GABC...XYZ' });
```

---

## `@ancore/account-abstraction`

### `AccountContract`

Low-level wrapper around the Soroban account contract. Used internally by
`@ancore/core-sdk` and available for advanced use cases.

```typescript
import { AccountContract } from '@ancore/account-abstraction';

const contract = new AccountContract('C...');
```

#### Builder methods (synchronous)

These return `InvocationArgs` — they do not submit transactions.

| Method | Signature | Description |
|--------|-----------|-------------|
| `initialize` | `(owner: string): InvocationArgs` | Build `initialize` invocation |
| `execute` | `(to, fn, args, nonce): InvocationArgs` | Build `execute` invocation |
| `addSessionKey` | `(publicKey, permissions, expiresAt): InvocationArgs` | Build `add_session_key` invocation (note: TS order differs from contract — contract is `public_key, expires_at, permissions`) |
| `revokeSessionKey` | `(publicKey): InvocationArgs` | Build `revoke_session_key` invocation |

#### Read methods (async — require RPC server)

```typescript
interface AccountContractReadOptions {
  server: {
    getAccount(id: string): Promise<{ id: string; sequence: string }>;
    simulateTransaction(tx: unknown): Promise<unknown>;
  };
  sourceAccount:     string;
  networkPassphrase?: string;
}
```

| Method | Returns | Description |
|--------|---------|-------------|
| `getOwner(options)` | `Promise<string>` | Owner address |
| `getNonce(options)` | `Promise<number>` | Current nonce |
| `getSessionKey(publicKey, options)` | `Promise<SessionKey \| null>` | Session key or null |

All read methods throw `AccountContractError` subclasses on failure.

#### `executeContract` / `simulateExecute`

```typescript
// Full submission
executeContract<T>(to, fn, args, nonce, options: ExecuteOptions): Promise<ExecuteResult<T>>

// Simulation only (no submission)
simulateExecute<T>(to, fn, args, nonce, options): Promise<T>
```

---

## Version compatibility

| SDK version | Contract version | Notes |
|-------------|-----------------|-------|
| `0.1.x` | `1` | Initial release |

Breaking changes to public APIs require a major version bump and RFC.
See [`RFC.md`](../RFC.md) for the process.
