# Troubleshooting Guide: Common Error Codes and Recovery Steps

This comprehensive guide details the error codes across the Ancore SDK (`@ancore/core-sdk`), Account Abstraction contract (`@ancore/account-abstraction`), network layer (`@ancore/stellar`), and secure storage subsystems. It provides root-cause explanations, diagnostic steps, code recipes, and automated recovery strategies.

---

## Table of Contents

1. [Error Classification & Architecture](#1-error-classification--architecture)
2. [Quick Reference Error Code Matrix](#2-quick-reference-error-code-matrix)
3. [Network & RPC Errors (Transient / Retryable)](#3-network--rpc-errors-transient--retryable)
4. [Soroban Simulation & Submission Errors](#4-soroban-simulation--submission-errors)
5. [Account Contract On-Chain Panics](#5-account-contract-on-chain-panics)
6. [Session Key Management & Expiration Errors](#6-session-key-management--expiration-errors)
7. [Validation & Builder Errors](#7-validation--builder-errors)
8. [Storage, Cryptography & Hardware Errors](#8-storage-cryptography--hardware-errors)
9. [Built-in Exponential Backoff & Retry Strategies](#9-built-in-exponential-backoff--retry-strategies)
10. [Escalation & Diagnostic Runbook](#10-escalation--diagnostic-runbook)

---

## 1. Error Classification & Architecture

Ancore errors follow a tiered hierarchy designed for both programmatic handling and clear user feedback:

```mermaid
graph TD
    Error[JavaScript Error] --> AncoreSdkError[AncoreSdkError (core-sdk)]
    Error --> AccountContractError[AccountContractError (account-abstraction)]
    Error --> StellarError[StellarError (stellar)]
    Error --> StorageError[StorageError (secure storage)]

    AncoreSdkError --> SimulationFailedError
    AncoreSdkError --> SimulationExpiredError
    AncoreSdkError --> TransactionSubmissionError
    AncoreSdkError --> BuilderValidationError
    AncoreSdkError --> SessionKeyManagementError
    AncoreSdkError --> SessionKeyExecutionError

    AccountContractError --> AlreadyInitializedError
    AccountContractError --> NotInitializedError
    AccountContractError --> InvalidNonceError
    AccountContractError --> UnauthorizedError
    AccountContractError --> SessionKeyNotFoundError
    AccountContractError --> SessionKeyExpiredError
    AccountContractError --> InsufficientPermissionError

    AncoreSdkError --> NormalizedError[NormalizedError via normalizeError()]
```

### Categorization via `normalizeError()`
Consumers (such as extension popups and web dashboards) use `normalizeError(err)` to map any raw or low-level exception into a typed category:
- `NETWORK`: Transient connection issues, rate limits, timeouts, or 5xx server errors.
- `VALIDATION`: Malformed public keys, invalid contract IDs, out-of-bounds amounts.
- `CONTRACT`: Nonce drift, authorization panics, expired session keys, simulation failures.
- `UNKNOWN`: Unhandled runtime exceptions.

---

## 2. Quick Reference Error Code Matrix

| Error Code | Category | Root Cause | Retryable? | Immediate Action |
| :--- | :--- | :--- | :--- | :--- |
| `TIMEOUT` / `ETIMEDOUT` | Network | RPC or Horizon server failed to respond before deadline | **Yes** (Exponential Backoff) | Apply `withRetry()` or switch RPC node |
| `ECONNRESET` / `ECONNREFUSED` | Network | TCP connection dropped or host unreachable | **Yes** | Retry request with jitter |
| `500` / `502` / `503` / `504` | Network | RPC node overload or upstream gateway failure | **Yes** | Wait for node recovery or failover |
| `429` (Rate Limited) | Network | Exceeded Horizon/RPC rate limits | **Yes** | Increase backoff delay / use private RPC |
| `SIMULATION_FAILED` | Contract | Contract invocation would revert on-chain | **No** (Fix parameters) | Inspect `diagnosticMessage` & authorization |
| `SIMULATION_EXPIRED` | Contract | State entry TTL expired or ledger advanced | **Yes** (Re-simulate) | Restore state or re-run simulation |
| `SUBMISSION_FAILED` | Contract / Network | Network rejected transaction (`tx_bad_seq`, `tx_insufficient_fee`) | **Depends** | Refresh sequence / bump gas fee |
| `ALREADY_INITIALIZED` (#1) | Contract | `initialize()` called more than once | **No** | Proceed with existing owner |
| `NOT_INITIALIZED` (#2) | Contract | Contract invoked before calling `initialize()` | **No** | Run `initialize(owner)` first |
| `UNAUTHORIZED` (#3) | Contract | Invoker is not owner or missing authorization | **No** | Sign with owner keypair or valid session key |
| `INVALID_NONCE` (#4) | Contract | Stale nonce or replay protection trigger | **Yes** (After sync) | Call `getNonce()` and re-sign payload |
| `SESSION_KEY_NOT_FOUND` (#5) | Contract | Public key not registered as session key | **No** | Call `addSessionKey()` |
| `SESSION_KEY_EXPIRED` (#6) | Contract | Timestamp > `expires_at` or Soroban TTL evicted | **Depends** | Extend Soroban TTL or create fresh key |
| `INSUFFICIENT_PERMISSION` (#7) | Contract | Session key missing permission bit for action | **No** | Grant permission in `addSessionKey()` |
| `INVALID_G_KEY` / `INVALID_C_KEY` | Validation | Invalid StrKey encoding (checksum/prefix mismatch) | **No** | Validate input address format |
| `INVALID_AMOUNT` | Validation | Negative, non-numeric, or exceeds decimal precision | **No** | Format using `normalizeAmount()` |
| `STORAGE_LOCKED` / `INVALID_PASSWORD` | Storage | Vault not unlocked or wrong decryption password | **No** | Prompt user for correct passphrase |

---

## 3. Network & RPC Errors (Transient / Retryable)

### 3.1 `TIMEOUT` / `ETIMEDOUT` / `ESOCKETTIMEDOUT`

#### Symptoms
```
Error: connect ETIMEDOUT 54.123.45.67:443
SimulationFailedError: Session key TTL simulation timed out after 15000ms.
```

#### Cause
Soroban RPC node, Horizon server, or relayer endpoint did not respond within the client timeout window due to high load, network congestion, or dropped packets.

#### Recovery Recipe
Wrap calls using `withRetry()` from `@ancore/core-sdk`:

```typescript
import { withRetry } from '@ancore/core-sdk';

const account = await withRetry(
  async () => server.getAccount(sourceAccount),
  {
    maxRetries: 3,
    baseDelayMs: 100,
    maxDelayMs: 10_000,
    jitter: true, // ±10% jitter prevents thundering herd
  }
);
```

---

### 3.2 `ECONNRESET` / `ECONNREFUSED` / `502` / `503` / `504`

#### Symptoms
```
Error: read ECONNRESET
Error: 503 Service Unavailable (RPC load shedding)
```

#### Cause
- Soroban RPC nodes actively dropping idle keep-alive connections.
- Load balancers shedding load during traffic spikes.

#### Recovery Steps
1. Verify node status via public health checks.
2. Configure Ancore client with automatic retry presets (`RELIABLE` or `LOW_LATENCY`):

```typescript
import { AncoreClient, RELIABLE } from '@ancore/core-sdk';

const client = new AncoreClient({
  accountContractId: 'CBPA...',
  retryOptions: RELIABLE, // 8 retries, exponential backoff starting at 3000ms
});
```

---

### 3.3 HTTP 429: Too Many Requests

#### Symptoms
```
HorizonError: Rate limit exceeded (status 429)
```

#### Cause
Public Horizon/RPC rate limits exceeded (typically 3600 requests/hour per IP on public testnet/mainnet nodes).

#### Recovery Steps
1. Add jittered delay and exponential backoff to avoid immediate consecutive strikes.
2. In production, provide custom RPC headers or dedicated RPC endpoint provider URLs in `HorizonServer` / `SorobanRpcServer`.

---

## 4. Soroban Simulation & Submission Errors

### 4.1 `SIMULATION_FAILED`

#### Symptoms
```
SimulationFailedError: Transaction simulation failed. This usually means the contract invocation would revert on-chain.
Diagnostic: HostError: Error(Contract, #4)
```

#### Cause
The contract logic threw an error during local node simulation. The inner error typically carries a Soroban contract panic code (e.g. `Error(Contract, #N)`).

#### Recovery Steps
1. Inspect the `diagnosticMessage` property on `SimulationFailedError`.
2. Map the diagnostic message using `mapContractError()`:

```typescript
import { mapContractError } from '@ancore/account-abstraction';

try {
  await client.refreshSessionKeyTtl(params, options);
} catch (error) {
  if (error instanceof SimulationFailedError) {
    console.error('Simulation diagnostic:', error.diagnosticMessage);
  }
}
```

---

### 4.2 `SIMULATION_EXPIRED`

#### Symptoms
```
SimulationExpiredError: The simulation result has expired or requires ledger entry restoration.
```

#### Cause
Soroban state entry TTL has expired or the ledger has advanced past the validity window between simulation and submission.

#### Recovery Steps
1. Re-simulate the transaction with fresh ledger sequence.
2. If contract persistent state is archived, issue a Soroban `RestoreFootprint` operation.

---

### 4.3 `SUBMISSION_FAILED` (`tx_bad_seq`, `tx_insufficient_fee`)

#### Symptoms
```
TransactionSubmissionError: Transaction submission failed: tx_bad_seq
ResultXdr: AAAA...
```

#### Cause
- `tx_bad_seq`: Account sequence number was consumed by a concurrent transaction.
- `tx_insufficient_fee`: Network base fee surged between simulation and inclusion.

#### Recovery Steps
```typescript
import { fetchAccountSequence, clearSequenceCache, withRetry } from '@ancore/core-sdk';

// 1. Clear sequence cache
clearSequenceCache(publicKey);

// 2. Fetch fresh sequence from Horizon
const { sequence } = await fetchAccountSequence(server, publicKey, { maxRetries: 3 });

// 3. Rebuild transaction with bumped fee
const tx = builder.setFee('200000').build();
```

---

## 5. Account Contract On-Chain Panics

Soroban contract error codes are defined in `contracts/account/src/lib.rs` and mapped by `@ancore/account-abstraction`:

### 5.1 `ALREADY_INITIALIZED` (Contract Error #1)
- **Cause**: Attempted to call `initialize(owner)` on a contract that already has an owner.
- **Recovery**: Do not call `initialize` again. Verify contract deployment state with `client.getOwner()`.

### 5.2 `NOT_INITIALIZED` (Contract Error #2)
- **Cause**: Calling contract execution methods before `initialize()` has been performed.
- **Recovery**: Call `initialize(ownerAddress)` with the owner's Stellar Ed25519 public key.

### 5.3 `UNAUTHORIZED` (Contract Error #3)
- **Cause**: Method invoker failed Soroban `require_auth()` or signed with a key that is neither owner nor authorized session key.
- **Recovery**: Verify signer keypair. If using session keys, verify that the session key has been registered with `addSessionKey()`.

### 5.4 `INVALID_NONCE` (Contract Error #4)

#### Symptoms
```
InvalidNonceError: Invalid nonce (replay or stale)
```

#### Cause
The expected nonce passed into `execute(..., expected_nonce, ...)` does not match the on-chain contract nonce `get_nonce()`.

#### Recovery Steps
Use `detectNonceDrift` and re-synchronize:

```typescript
import { detectNonceDrift, NonceDriftKind } from '@ancore/account-abstraction';

const serverNonce = await accountContract.getNonce(readOptions);
const drift = detectNonceDrift(localNonce, serverNonce);

if (drift.kind === NonceDriftKind.Stale) {
  console.warn('Local nonce is behind server. Fast-forwarding to:', serverNonce);
  // Re-sign execution payload using serverNonce
}
```

---

## 6. Session Key Management & Expiration Errors

### 6.1 `SESSION_KEY_NOT_FOUND` (Contract Error #5)
- **Cause**: Contract does not have a registered entry for the provided `session_pub_key`.
- **Recovery**: Call `addSessionKey(publicKey, permissions, expiresAt)` before executing.

### 6.2 `SESSION_KEY_EXPIRED` (Contract Error #6)
- **Cause**: Either:
  1. Current Unix timestamp exceeds the session key's logical `expires_at`.
  2. Soroban storage persistent TTL was evicted by the ledger runtime.
- **Recovery**:
  - If logical expiry is in the future: call `refreshSessionKeyTtl(publicKey)` to extend Soroban storage TTL.
  - If logical expiry passed: call `addSessionKey()` to issue a brand new session key.

### 6.3 `INSUFFICIENT_PERMISSION` (Contract Error #7)
- **Cause**: The session key's permission bitmask does not include the permission required for the targeted contract method.
- **Recovery**:
  1. Decode existing permissions with `permissionsToLabels(permissions)`.
  2. Add missing permission bit (e.g. `PERMISSION_EXECUTE`, `PERMISSION_PAYMENT`) and re-issue the session key.

---

## 7. Validation & Builder Errors

### 7.1 `INVALID_G_KEY` & `INVALID_C_KEY`
- **Cause**: Public key is not a valid 56-character Ed25519 Stellar address (`G...`) or contract address (`C...`).
- **Recovery**: Use `assertValidEd25519PublicKey(key)` and `assertValidContractId(id)` for early client-side validation.

### 7.2 `INVALID_AMOUNT`
- **Cause**: Amount string is negative, zero, non-numeric, or has more than 7 decimal places for Stellar assets.
- **Recovery**: Use `normalizeAmount(input, { maxDecimals: 7 })` before building payment payloads.

---

## 8. Storage, Cryptography & Hardware Errors

### 8.1 `STORAGE_LOCKED` / `INVALID_PASSWORD`
- **Cause**: Session storage or account vault is locked, or decryption failed due to incorrect password PBKDF2/AES key derivation.
- **Recovery**: Catch `StorageError` with `StorageErrorCode.INVALID_PASSWORD` and prompt the user to re-enter their unlock passphrase.

### 8.2 `CORRUPTED_PAYLOAD`
- **Cause**: Local storage contains malformed JSON or authentication tag mismatch on AES-GCM decryption.
- **Recovery**: Restore wallet state from mnemonic backup phrase using `restoreWallet({ mnemonic, password })`.

### 8.3 Hardware Wallet (Ledger) Errors
- `LedgerDeviceLockedError`: Prompt user to enter PIN on Ledger device.
- `LedgerAppNotOpenError`: Prompt user to open the Stellar app on Ledger.
- `LedgerDisconnectedError`: Verify WebHID permissions and USB cable connection.

---

## 9. Built-in Exponential Backoff & Retry Strategies

Ancore provides built-in exponential backoff with jitter via `withRetry()`:

### Formula
$$\text{delay} = \min(\text{baseDelay} \times 2^{\text{attempt}}, \text{maxDelay}) \times (1 \pm \text{jitter})$$

### Pre-configured Presets
```typescript
import {
  withRetry,
  LOW_LATENCY, // 2 retries, 200ms base, fast fail for UI
  RELIABLE,    // 8 retries, 3000ms base, for background operations
  AGGRESSIVE,  // 4 retries, 500ms base, for high-throughput batching
} from '@ancore/core-sdk';

// Usage example:
const txResult = await withRetry(
  async () => submitTransaction(tx),
  RELIABLE
);
```

### Custom Retry Configuration
```typescript
import { withRetry, isTransientNetworkError } from '@ancore/core-sdk';

const result = await withRetry(
  async () => fetchRpcEndpoint(),
  {
    maxRetries: 3,        // Maximum 3 retries (4 total attempts)
    baseDelayMs: 100,     // Start with 100ms
    maxDelayMs: 10_000,   // Max cap 10s
    jitter: true,         // ±10% jitter
    onRetry: (attempt, error, delayMs) => {
      console.warn(`[Retry ${attempt}] Retrying after ${delayMs}ms due to:`, error);
    },
  }
);
```

---

## 10. Escalation & Diagnostic Runbook

When filing an issue or escalating a support ticket, gather the following details:

1. **Environment**:
   - SDK Version: `SDK_VERSION` / `AA_VERSION`
   - Network: Testnet (`Passphrase: Test SDF Network ; September 2015`) or Mainnet
   - Node RPC URL: e.g. `https://soroban-testnet.stellar.org`
2. **Error Telemetry**:
   - Exact `error.name` and `error.code`
   - Raw `resultXdr` or `diagnosticMessage`
   - Network HTTP status code (if applicable)
3. **Transaction Context**:
   - Contract ID (`C...`) and Source Account (`G...`)
   - Sequence number and on-chain nonce
   - Session key public key and expiry timestamp
