# Ancore Integration Guide

This document contains two main sections:
1. **[dApp Integration Guide](#dapp-integration-guide)** — For external developers integrating `@ancore/wallet-api` in their dApps.
2. **[Internal Integration Guide](#internal-integration-guide)** — For internal Ancore teams working on the extension, mobile wallet, or dashboard.

---

# dApp Integration Guide

## Quick Start

Integrating Ancore into your Stellar/Soroban dApp is designed to be as close to Freighter as possible, but with additional features for Account Abstraction (AA) and session keys.

### 1. Installation
Install the Ancore wallet API wrapper:
```bash
npm install @ancore/wallet-api
```

### 2. Connect Wallet
Request permission to connect and retrieve the user's smart account address:
```javascript
import { connect, getAddress } from '@ancore/wallet-api';

try {
  // Requests connection
  await connect();
  const address = await getAddress();
  console.log("Connected smart account address:", address);
} catch (error) {
  console.error("Connection failed", error);
}
```

### 3. Sign a Transaction
Sign a Stellar transaction envelope (XDR):
```javascript
import { signTransaction } from '@ancore/wallet-api';

try {
  const signedXdr = await signTransaction({
    xdr: 'AAAAAgAAAAD...',
    network: 'TESTNET',
  });
  console.log("Signed transaction XDR:", signedXdr);
} catch (error) {
  console.error("Signing rejected by user", error);
}
```

---

## Smart Account Differences (C-Address vs G-Address)

Ancore is a smart contract wallet (Account Abstraction).
- **C-Address**: The address returned by `getAddress()` is a contract address (starting with `C...`), unlike traditional Stellar accounts which start with `G...`.
- **Targeting Payments**: When building payment operations targeting an Ancore account, use contract-compatible payment operations (e.g., Soroban token transfers) instead of classic Stellar asset transfers, or ensure your dApp supports contract destinations.

---

## Session Keys for Gasless/Promptless Transactions

dApps can request a scoped session key to sign transactions in the background without prompting the user for every action.

```javascript
import { requestSessionKey } from '@ancore/wallet-api';

try {
  const session = await requestSessionKey({
    allowlist: ['CB...contractAddress'],
    methods: ['play_game'],
    maxAmount: '50.0000000',
    durationSeconds: 3600, // 1 hour session
  });
  
  console.log("Active Session Key Public Key:", session.publicKey);
} catch (error) {
  console.error("Session key request denied", error);
}
```

---

## Smart Account Authorization (`signAuthEntry` / SEP-43)

For Soroban-based smart contract authorization, use the SEP-43 signature delegation pattern:

```javascript
import { signAuthEntry } from '@ancore/wallet-api';

const signedEntry = await signAuthEntry({
  entry: authEntryXdr,
  network: 'TESTNET',
});
```

---

## Error Handling

The API throws typed errors representing specific user interactions or system boundaries:
- `AncoreUserRejectedError`: The user declined the connection or transaction signature request.
- `AncoreTimeoutError`: The signature request timed out.
- `AncoreNotConnectedError`: Triggered when attempting to sign before calling `connect()`.

```javascript
import { signTransaction, AncoreUserRejectedError } from '@ancore/wallet-api';

try {
  await signTransaction({ xdr });
} catch (err) {
  if (err instanceof AncoreUserRejectedError) {
    showUserToast("Signature declined by user.");
  } else {
    showUserToast("An unexpected error occurred.");
  }
}
```

---

## Migration from Freighter

Migrating from `@stellar/freighter-api` to `@ancore/wallet-api` requires changing the import source; the base method signatures are backward-compatible:

```diff
- import { connect, getAddress, signTransaction } from "@stellar/freighter-api";
+ import { connect, getAddress, signTransaction } from "@ancore/wallet-api";
```

---

# Internal Integration Guide

> Team guidelines for integrating with Ancore contract methods and SDK wrappers.  
> Issue #287 — prevents integration drift across extension, mobile, and dashboard teams.  

## Package responsibilities

| Package | Owner | Stability | Purpose |
|---------|-------|-----------|---------|
| `@ancore/core-sdk` | Core team | Public SemVer | High-level SDK for app developers |
| `@ancore/account-abstraction` | Core team | Public SemVer | Low-level contract wrapper |
| `@ancore/types` | Core team | Public SemVer | Shared TypeScript types |
| `contracts/account` | Core team | High security | Soroban account contract |

App teams (`apps/extension-wallet`, `apps/mobile-wallet`, `apps/web-dashboard`)
consume `@ancore/core-sdk` and `@ancore/types`. They do **not** import directly
from `@ancore/account-abstraction` unless building advanced tooling.

---

## Integration checklist

Before shipping any feature that touches contract methods or SDK wrappers:

- [ ] Verify the method signature against `api-reference.yaml`
- [ ] Handle all documented error codes (see error handling section below)
- [ ] Fetch the nonce immediately before any `execute` call
- [ ] Never hardcode nonces — always read from the contract
- [ ] Test against Testnet before Mainnet
- [ ] If a signature change is needed, open an RFC (see [RFC.md](../RFC.md))

---

## Error handling contract

All teams must handle errors using the typed error classes. Never catch a bare
`Error` and swallow it silently.

### Minimum required handling

```typescript
import {
  AncoreSdkError,
  BuilderValidationError,
  SessionKeyExecutionError,
  SessionKeyExecutionValidationError,
  SimulationFailedError,
  TransactionSubmissionError,
} from '@ancore/core-sdk';

function handleSdkError(error: unknown): never {
  if (error instanceof BuilderValidationError) {
    // Programming error — fix the call site
    throw error;
  }

  if (error instanceof SessionKeyExecutionValidationError) {
    // Bad inputs — fix the call site
    throw error;
  }

  if (error instanceof SessionKeyExecutionError) {
    // Map to user-facing message by error.code
    switch (error.code) {
      case 'SESSION_KEY_EXECUTION_UNAUTHORIZED':
        showUserError('Session key not authorized. Please re-authenticate.');
        break;
      case 'SESSION_KEY_EXECUTION_INVALID_NONCE':
        // Retry once after re-fetching nonce
        retryWithFreshNonce();
        break;
      default:
        showUserError('Transaction failed. Please try again.');
    }
    throw error;
  }

  if (error instanceof SimulationFailedError) {
    showUserError('Transaction would fail on-chain. Check your inputs.');
    throw error;
  }

  if (error instanceof TransactionSubmissionError) {
    showUserError('Network error. Please check your connection and retry.');
    throw error;
  }

  throw error;
}
```

### Nonce retry pattern

`InvalidNonce` can occur when two operations race. Retry once with a fresh nonce:

```typescript
async function executeWithRetry(params, contract, readOptions) {
  try {
    const nonce = await contract.getNonce(readOptions);
    return await executeWithSessionKey({ ...params, expectedNonce: nonce });
  } catch (error) {
    if (
      error instanceof SessionKeyExecutionError &&
      error.code === 'SESSION_KEY_EXECUTION_INVALID_NONCE'
    ) {
      // Retry once
      const freshNonce = await contract.getNonce(readOptions);
      return await executeWithSessionKey({ ...params, expectedNonce: freshNonce });
    }
    throw error;
  }
}
```

---

## Relayer error codes

When a client calls the relayer (`POST /relay/execute` or `POST /relay/validate`), business-logic
failures are returned as a `422` response with a typed `error.code`. Clients **must** handle all
codes explicitly — do not swallow or re-throw a bare `Error` without mapping it.

### Error code table

| Code | HTTP status | Client action |
|---|---|---|
| `INVALID_SIGNATURE` | 422 | Re-sign the payload with the correct session key and retry |
| `SESSION_KEY_EXPIRED` | 422 | Prompt the user to re-authenticate; obtain a new session key |
| `NONCE_REPLAY` | 422 | Fetch a fresh nonce from the contract and retry once |
| `GAS_LIMIT_EXCEEDED` | 422 | Reduce operation complexity or split into smaller transactions |
| `SIMULATION_FAILED` | 422 | Check contract inputs and account state; do not auto-retry |
| `UNAUTHORIZED` | 401 | Re-authenticate and obtain a new Bearer token |
| `VALIDATION_ERROR` | 400 | Fix the request shape at the call site (programming error) |
| `INTERNAL_ERROR` | 500 | Log and surface a generic retry message; do not expose internals |

---

## Session key lifecycle

```
Owner adds key  →  App uses key  →  Key expires or owner revokes
```

**Adding a key**

```typescript
const invocation = client.addSessionKey({
  publicKey:   sessionKeyPublicKey,
  permissions: [SessionPermission.SEND_PAYMENT],
  expiresAt:   Math.floor(Date.now() / 1000) + 86400, // unix seconds — 24 h from now
});
// Build and submit with owner signature
```

**Checking if a key is still active** (before using it)

```typescript
const activeInvocation = contract.call('is_session_key_active', publicKeyScVal);
const sessionKey = await contract.getSessionKey(publicKey, readOptions);
const isActive = sessionKey !== null && sessionKey.expiresAt > Date.now();
```

**Revoking a key**

```typescript
const invocation = client.revokeSessionKey({ publicKey: sessionKeyPublicKey });
// Build and submit with owner signature
```
