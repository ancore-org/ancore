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

| Error                     | When                                                                  |
| ------------------------- | --------------------------------------------------------------------- |
| `WalletNotInstalledError` | Extension content script is not present on the page                   |
| `WalletApiError`          | Background rejected the request or bridge timed out (default **30s**) |

```typescript
import { WalletApiError, WalletNotInstalledError } from '@ancore/wallet-api';

try {
  await connect();
} catch (err) {
  if (err instanceof WalletNotInstalledError) {
    // prompt user to install Ancore Wallet
  } else if (err instanceof WalletApiError) {
    // user rejected, timeout, or handler error
  }
}
```

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
