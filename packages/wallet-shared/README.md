# @ancore/wallet-shared

Shared constants and dApp ↔ extension protocol types for Ancore wallets.

Used by:

- `@ancore/wallet-api` (dApp npm SDK)
- `apps/extension-wallet` content script + background
- Future mobile WalletConnect handlers

## Exports

- **protocol** — `ANCORE_WALLET_REQUEST`, `ExternalApiMethod`, envelope validators
- **networks** — passphrases, Horizon/Soroban RPC defaults, `allowlistStorageKey`
- **session** — unlock session TTL constants for MV3 service worker
- **allowlist** — `AllowlistEntry`, `parseAllowlist`, `serializeAllowlist`, `isOriginAllowed`, `addOriginToAllowlist`, `removeOriginFromAllowlist`

## Allowlist helpers

The allowlist module implements per-origin dApp access control keyed by
`(network, smartAccountId, origin)`. This follows the Freighter pattern but
uses the Soroban smart account C-address (`smartAccountId`) instead of the
G-key signer, since that is the user-visible address in Ancore.

**Typical usage in the extension background:**

```ts
import {
  allowlistStorageKey,
  parseAllowlist,
  serializeAllowlist,
  isOriginAllowed,
  addOriginToAllowlist,
} from '@ancore/wallet-shared';

// Read
const raw = await chrome.storage.local.get(allowlistStorageKey(network, smartAccountId));
const entries = parseAllowlist(raw[key]);

// Check
if (!isOriginAllowed(entries, origin, network)) {
  /* prompt user */
}

// Grant
const updated = addOriginToAllowlist(entries, {
  origin,
  grantedAt: Date.now(),
  network,
  smartAccountId,
});
await chrome.storage.local.set({ [key]: serializeAllowlist(updated) });
```

## Related

- [Wallet extension architecture](../../docs/architecture/WALLET_EXTENSION.md)
- [Freighter comparison](../../docs/wallets/FREIGHTER_COMPARISON.md)
