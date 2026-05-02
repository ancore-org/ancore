# Integration Guide

> Team guidelines for integrating with Ancore contract methods and SDK wrappers.  
> Issue #287 — prevents integration drift across extension, mobile, and dashboard teams.  
> Last updated: 2026-04-24

---

## Purpose

This guide establishes a shared process so that the extension, mobile, and
dashboard teams use the same interface contracts, error handling patterns, and
update workflow. It is the companion to the reference docs:

| Document | What it covers |
|----------|---------------|
| [`api-reference.yaml`](./api-reference.yaml) | Machine-readable spec (source of truth) |
| [`contract-methods.md`](./contract-methods.md) | Contract entrypoints, params, errors, events |
| [`sdk-wrappers.md`](./sdk-wrappers.md) | SDK wrapper methods and error hierarchy |
| [`examples/session-key-execute.md`](./examples/session-key-execute.md) | Session-key execute flow |
| [`examples/send-payment.md`](./examples/send-payment.md) | Payment flow |

---

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
// is_session_key_active and refresh_session_key_ttl are contract entrypoints
// with no TypeScript wrapper in AccountContract. Invoke them via a raw simulation:
const activeInvocation = contract.call('is_session_key_active', publicKeyScVal);
// Or check expiry client-side from a stored SessionKey:
const sessionKey = await contract.getSessionKey(publicKey, readOptions);
const isActive = sessionKey !== null && sessionKey.expiresAt > Date.now(); // expiresAt is ms in TS types
```

**Refreshing storage TTL** (before Soroban evicts the entry)

```typescript
// refresh_session_key_ttl has no TypeScript wrapper in AccountContract.
// Invoke it via the contract's call() method:
const op = contract.call('refresh_session_key_ttl', publicKeyScVal);
// Build and submit this operation (no owner auth required).
```

**Revoking a key**

```typescript
const invocation = client.revokeSessionKey({ publicKey: sessionKeyPublicKey });
// Build and submit with owner signature
```

---

## Keeping documentation in sync

When you change a contract entrypoint or SDK method signature:

1. Update `docs/api-reference.yaml` — this is the source of truth
2. Update the relevant section in `contract-methods.md` or `sdk-wrappers.md`
3. Update any affected examples in `docs/examples/`
4. If it is a breaking change, open an RFC and bump the major version

**Breaking change definition**

- Removing or renaming a parameter
- Changing a parameter type
- Adding a required parameter
- Changing a return type
- Removing an error code

Adding optional parameters or new error codes is non-breaking.

---

## Team-specific notes

### Extension wallet (`apps/extension-wallet`)

- Session keys are stored in encrypted extension storage via `SecureStorageManager`
- Sign auth entries through the background service message bus (see
  [`examples/session-key-execute.md`](./examples/session-key-execute.md#extension-wallet-appsextension-wallet))
- Use `chrome.runtime.sendMessage` for cross-context signing

### Mobile wallet (`apps/mobile-wallet`)

- Session keys are stored in the device keychain / secure enclave
- Sign transactions using the platform keychain API
- Handle `SimulationExpiredError` by prompting the user to retry — do not
  silently swallow it

### Web dashboard (`apps/web-dashboard`)

- The dashboard may hold session keys in memory for the duration of a session
- Clear keys on logout / tab close
- Use `@ancore/crypto` signing utilities for in-browser key operations

---

## Testnet vs Mainnet

| Setting | Testnet | Mainnet |
|---------|---------|---------|
| Network passphrase | `Test SDF Network ; September 2015` | `Public Global Stellar Network ; September 2015` |
| RPC URL | `https://soroban-testnet.stellar.org` | `https://soroban.stellar.org` |
| Horizon URL | `https://horizon-testnet.stellar.org` | `https://horizon.stellar.org` |

Always test on Testnet first. Contract IDs differ between networks — never
hardcode a contract ID; read it from environment configuration.

---

## Related

- [Architecture overview](./architecture/OVERVIEW.md)
- [Security model](./security/THREAT_MODEL.md)
- [Contributing guide](../CONTRIBUTING.md)
- [RFC process](../RFC.md)
