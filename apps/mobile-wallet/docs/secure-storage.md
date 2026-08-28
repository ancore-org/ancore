# Mobile Wallet Secure Storage

The mobile wallet separates persisted data into two tiers. **Which tier a field
lives in is a security boundary, not a preference.**

## Storage tiers

| Tier             | Backend                                       | Adapter                        | Contents                                                                 |
| ---------------- | --------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------ |
| **Secure**       | iOS Keychain / Android Keystore               | `KeychainSecureStoreAdapter`   | Mnemonics, private/key material, the encrypted vault state & account blobs |
| **Data**         | AsyncStorage (added with the host app, #780)  | _not the secure adapter_       | Non-sensitive account metadata, UI preferences, last-selected network    |

### The rule

> **Never** store a mnemonic, private key, or any unencrypted key material in
> AsyncStorage. Seeds and key material live in the Keychain only — this mirrors
> Freighter Mobile's `storageFactory` Secure/Data tier split.

Concretely, everything written through `SecureStoreAdapter` belongs in the
Keychain. Today that means the unified `SecureStorageManager` metadata keys
(`master_salt`, `verification_payload`) plus any encrypted account/session
payloads. AsyncStorage may only hold values that would be harmless if read off a
compromised device — display labels, the selected network name, feature flags.
When in doubt, put it in the secure tier.

## Adapters

| Adapter                      | When                              | Persistence                       |
| ---------------------------- | --------------------------------- | --------------------------------- |
| `KeychainSecureStoreAdapter` | Production (device / simulator)   | Survives cold start (Keychain)    |
| `MemorySecureStoreAdapter`   | Jest unit tests                   | In-memory; lost on restart        |

Select the right one with the factory — it returns the memory adapter under Jest
(where the native Keychain bridge is unavailable) and the Keychain adapter
otherwise:

```typescript
import { SecureStorageManager } from '@ancore/core-sdk';
import { createSecureStoreAdapter } from '@ancore/mobile-wallet';

const store = createSecureStoreAdapter();
const vault = new SecureStorageManager(store);
```

### Keychain service scoping

Keychain entries are namespaced by bundle ID so production and development builds
installed on the same device never share secrets:

- Production: `org.ancore.wallet`
- Development: `org.ancore.wallet.dev`

Each logical key is stored under `<bundleId>.<key>` (for example
`org.ancore.wallet.mobile_vault_state`). Because Keychain has no "list all
entries" primitive, the adapter maintains a small `__keys__` index entry so
`clear()` can reset every key it has written.

### Serialization

`SecureStoreAdapter` stores the unified vault's raw encrypted payload strings, so
the adapter writes those strings directly to Keychain.

## Device validation (requires host app #780)

Unit tests cover the adapter with a mocked `react-native-keychain`. The remaining
acceptance criterion — _vault persists across cold start_ — requires the React
Native host app and is validated as manual QA:

1. Create or import a wallet, then fully terminate the app.
2. Relaunch and confirm the vault unlocks with the existing password and that
   accounts are still present.
