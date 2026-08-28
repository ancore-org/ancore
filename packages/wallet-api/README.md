# @ancore/wallet-api

Browser SDK for dApps integrating with the **Ancore Wallet** extension.

Production reference: [@stellar/freighter-api](https://github.com/stellar/freighter/tree/master/@stellar/freighter-api).

## Status

| Method              | Status                                      |
| ------------------- | ------------------------------------------- |
| `connect()`         | ✅ Wired to extension content-script bridge |
| `getAddress()`      | ✅ Wired to extension content-script bridge |
| `getNetwork()`      | ✅ Wired to extension content-script bridge |
| `isConnected()`     | ✅ Wired to extension content-script bridge |
| `requestAccess()`   | ✅ Extension background handler             |
| `signTransaction()` | ✅ Extension background handler             |
| `signAuthEntry()`   | ✅ Extension background handler             |
| `signMessage()`     | ✅ Extension background handler             |
| `getSmartAccount()` | ✅ Extension background handler             |

Tracked in [FREIGHTER_COMPARISON](../../docs/wallets/FREIGHTER_COMPARISON.md) and [issue #813](https://github.com/ancore-org/ancore/issues/813).

## Install

```bash
pnpm add @ancore/wallet-api
```

Monorepo consumers:

```bash
pnpm --filter @ancore/wallet-api build
```

## Quick start

```typescript
import { connect, getAddress, getNetwork, isConnected, signTransaction } from '@ancore/wallet-api';

// 1. Connect (opens approval if origin is not allowlisted)
const smartAccountId = await connect();
console.log('Connected smart account:', smartAccountId);

// 2. Check connection without prompting
if (await isConnected()) {
  const { smartAccountId: address } = await getAddress();
  const network = await getNetwork(); // 'testnet' | 'mainnet'
  console.log(address, network);
}

// 3. Sign a transaction (user approval in extension popup/side panel)
const { signedXdr } = await signTransaction({
  xdr: unsignedXdr,
  networkPassphrase: 'Test SDF Network ; September 2015',
});
```

## Connection API (#813)

These methods postMessage from the dApp page to the extension content script, which forwards requests to the background service worker.

### `connect(): Promise<string>`

Prompts the user to grant access when the current origin is not on the allowlist. Resolves with the smart account **C-address** on approval.

```typescript
const smartAccountId = await connect();
```

### `getAddress(): Promise<{ smartAccountId: string; ownerPublicKey?: string }>`

Returns the active smart account without opening a new approval window. Maps the background `{ address }` payload to `{ smartAccountId }` for dApps.

```typescript
const { smartAccountId, ownerPublicKey } = await getAddress();
```

### `getNetwork(): Promise<'mainnet' | 'testnet'>`

Returns the wallet's active Stellar network from extension settings.

```typescript
const network = await getNetwork();
```

### `isConnected(): Promise<boolean>`

Returns whether the current page origin is allowlisted for the active account.

```typescript
if (await isConnected()) {
  // safe to call getAddress() without connect()
}
```

## Errors

Every rejection from this package is a `WalletApiError` (or its `WalletNotInstalledError`
subclass). There is no numeric error code — **the `message` string is the discriminator**, so the
tables below list the exact strings the extension produces today.

### Error classes

| Class                     | `instanceof WalletApiError` | Thrown today?                                                                                                                                                                                   |
| ------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WalletApiError`          | yes                         | Yes — every failure path below                                                                                                                                                                  |
| `WalletNotInstalledError` | yes (it extends it)         | **Not yet.** Exported for `instanceof` narrowing; with no content script on the page the request currently fails as a timeout instead. See [detecting the extension](#detecting-the-extension). |

Because `WalletNotInstalledError extends WalletApiError`, always check the **subclass first** in an
`if / else if` chain.

### Connect and read errors

Raised by `connect()`, `requestAccess()`, `getAddress()`, `getNetwork()`, `isConnected()` and
`getSmartAccount()`.

| `error.message`                                 | Origin                    | What happened                                                                    | dApp should                                      |
| ----------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------ |
| `wallet-api requires a browser window`          | wallet-api bridge         | Called where `window` is undefined (SSR, Node, a worker)                         | Only call the SDK from client-side code          |
| `Request timed out after 30000ms`               | wallet-api bridge         | No response within **30s** — usually no extension installed, or a stalled worker | Prompt to install the wallet, then offer a retry |
| `Origin not allowed. Call requestAccess first.` | background handler        | Page origin is not on the allowlist for the active account                       | Call `connect()` / `requestAccess()`, then retry |
| `Wallet not set up. Complete onboarding first.` | background handler        | Extension installed but onboarding never finished                                | Ask the user to finish wallet setup              |
| `Invalid origin`                                | background service worker | Request arrived with a missing or non-string origin                              | Treat as a bug; do not retry                     |
| `Origin mismatch`                               | background service worker | Sender origin does not match the claimed origin                                  | Treat as a bug; do not retry                     |
| `Unknown method: <method>`                      | content script            | Method not recognised by this extension build                                    | Check the installed extension version            |
| `Unknown external API method: <method>`         | background registry       | Method reached the background but has no handler                                 | Check the installed extension version            |
| `Unexpected response from background`           | content script            | Background replied with a malformed envelope                                     | Retry once, then surface a generic failure       |
| `Unknown wallet error`                          | wallet-api bridge         | Background reported failure with no message                                      | Surface a generic failure                        |

### Signing errors

Raised by `signTransaction()`, `signAuthEntry()`, `signMessage()` and `requestSessionKey()`. These
open an approval screen, so they can also fail on the user's decision.

| `error.message`                                                 | Origin             | What happened                                                     | dApp should                                                        |
| --------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| `Origin not allowed. Call requestAccess first.`                 | background handler | Not allowlisted — checked **before** the approval UI opens        | Call `connect()` first                                             |
| `User rejected the sign request`                                | approval UI        | User pressed **Reject**                                           | Cancel silently — this is a normal outcome, not an error to report |
| `Approval request timed out.`                                   | background handler | No decision within **5 minutes** (e.g. the popup was closed)      | Offer a retry                                                      |
| `Request timed out after 30000ms`                               | wallet-api bridge  | The bridge's own 30s budget elapsed first                         | See [timeouts](#two-timeouts-not-one)                              |
| `Session key policy must include a future expiresAt timestamp.` | background handler | `requestSessionKey()` policy had a missing or past `expiresAt`    | Fix the policy — this is a caller bug                              |
| `Session key policy must include permissions.`                  | background handler | `requestSessionKey()` policy had no numeric `permissions` bitmask | Fix the policy — this is a caller bug                              |

### Two timeouts, not one

The signing path has **two independent clocks**, and the shorter one wins:

- the bridge rejects after **30s** (`Request timed out after 30000ms`);
- the background gives the user **5 minutes** to approve (`Approval request timed out.`).

A user who takes longer than 30 seconds to read an approval screen therefore sees the dApp give up
while the extension is still waiting. Do not treat a bridge timeout as "the user declined" — if the
approval is later accepted the transaction is still signed. Re-check state with `isConnected()` /
`getAddress()` before retrying.

### Handling errors

```typescript
import {
  connect,
  signTransaction,
  WalletApiError,
  WalletNotInstalledError,
} from '@ancore/wallet-api';

/** Map a wallet-api rejection to something worth showing a user. */
function describe(err: unknown): { message: string; retryable: boolean } {
  // Subclass first — WalletNotInstalledError is also a WalletApiError.
  if (err instanceof WalletNotInstalledError) {
    return { message: 'Install the Ancore Wallet extension to continue.', retryable: false };
  }

  if (!(err instanceof WalletApiError)) {
    return { message: 'Something went wrong.', retryable: true };
  }

  if (err.message.startsWith('Origin not allowed')) {
    return { message: 'Connect your wallet to this site first.', retryable: true };
  }

  if (err.message.startsWith('Wallet not set up')) {
    return { message: 'Finish setting up your Ancore Wallet, then try again.', retryable: false };
  }

  if (err.message.includes('timed out')) {
    return { message: 'The wallet did not respond in time.', retryable: true };
  }

  return { message: err.message, retryable: true };
}

async function signWithWallet(xdr: string) {
  try {
    await connect();
    const { signedXdr } = await signTransaction({
      xdr,
      networkPassphrase: 'Test SDF Network ; September 2015',
    });
    return signedXdr;
  } catch (err) {
    // A rejected approval is a user choice, not a failure — bail out quietly.
    if (err instanceof WalletApiError && err.message === 'User rejected the sign request') {
      return null;
    }

    const { message, retryable } = describe(err);
    showToast(message, { action: retryable ? 'Retry' : undefined });
    throw err;
  }
}
```

### Detecting the extension

`WalletNotInstalledError` is not thrown yet, so a page with no extension pays the full 30-second
bridge timeout. Until the presence check lands, race the call against a short deadline of your own:

```typescript
import { isConnected, WalletApiError } from '@ancore/wallet-api';

/** Resolves false when no extension answers within `ms`. */
async function walletPresent(ms = 1000): Promise<boolean> {
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), ms));

  try {
    return await Promise.race([isConnected().then(() => true), timeout]);
  } catch (err) {
    if (err instanceof WalletApiError) return false;
    throw err;
  }
}
```

> **Follow-up:** the hardened error surface — real `WalletNotInstalledError` throwing, a stable
> machine-readable `code` on each error, and a playground to exercise every path — is tracked in
> [issue #1009](https://github.com/ancore-org/ancore/issues/1009). Match on `message` only until
> that lands, and keep the comparisons in one place so the migration to `code` is a single edit.

## Protocol

PostMessage types live in `@ancore/wallet-shared`. The content script validates `ANCOR_WALLET_REQUEST` before forwarding to the background service worker.

```
dApp page  →  wallet-api  →  content script  →  background  →  approval UI
                (postMessage)     (chrome.runtime)      (handlers)
```

Relevant `ExternalApiMethod` values: `CONNECT`, `GET_ADDRESS`, `GET_NETWORK`, `IS_CONNECTED`.

## Ancore vs Freighter

| Freighter           | Ancore                                                |
| ------------------- | ----------------------------------------------------- |
| Classic G-address   | **Smart account contract id** (primary address)       |
| `getAddress()` → G… | `getAddress()` → C… + optional owner G…               |
| Direct key sign     | Owner key or **session key** via contract permissions |
| Horizon submit      | Optional **relayer** submit for AA meta-txs           |

Do not remove AA-specific methods when extending handlers.

## Versioning and Semver Policy

`@ancore/wallet-api` follows [Semantic Versioning](https://semver.org).

| Range   | Meaning                                                                 | Current state                                                    |
| ------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `0.x`   | Public API is in progress — minor releases may contain breaking changes | **Publishing now**                                               |
| `1.0.0` | All methods fully wired to extension handlers; API is stable            | Gated on [#766](https://github.com/ancore-org/ancore/issues/766) |
| `^1.x`  | Breaking API change → major bump; additive change → minor bump          | After 1.0.0                                                      |

**What "breaking" means for this package:**

- Removing or renaming an exported function or type
- Changing the resolved type of a Promise return value
- Adding a required parameter to an existing function
- Changing error class names (dApps `instanceof`-check these)

**What is not breaking:**

- Adding a new exported function
- Adding optional parameters (new overload)
- Extending a return type with new optional fields

During `0.x` the package is safe to depend on for integration and testing purposes.
Pin to an exact version (`"@ancore/wallet-api": "0.1.0"`) until `1.0.0` is released.

### Release process

1. Bump `version` in `packages/wallet-api/package.json`.
2. Push a git tag: `wallet-api/v<version>` (e.g. `wallet-api/v0.2.0`).
3. The [publish-wallet-api](.github/workflows/publish-wallet-api.yml) CI workflow
   builds, tests, and publishes to npm automatically.

The workflow fails if the version is already published — bump the version before tagging.

## Development

```bash
pnpm --filter @ancore/wallet-api test
pnpm --filter @ancore/wallet-api typecheck
```

Load the unpacked extension from `apps/extension-wallet` and call the SDK from a local dApp page to verify end-to-end connectivity.
