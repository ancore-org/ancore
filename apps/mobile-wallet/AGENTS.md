# Ancore Mobile Wallet

> Mobile wallet **library and security primitives** for the Ancore account abstraction stack.
> Embeddable React components/hooks — not yet a standalone App Store / Play Store app.
> Production benchmark: [Freighter Mobile AGENTS.md](https://github.com/stellar/freighter-mobile/blob/main/AGENTS.md).

## Glossary

| Term                     | Meaning                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------- |
| **Mobile shell**         | `MobileWalletShell` + navigation — host app wiring surface                          |
| **MobileSecureVault**    | PBKDF2 + AES-GCM vault in `src/security/mobile-secure-vault.ts`                     |
| **Secure store adapter** | Pluggable backend for vault secrets (`storage/mobile-secure-storage-adapter.ts`)    |
| **Indexer adapter**      | `createIndexerActivityAdapter` — paginated history from Ancore indexer REST API     |
| **Smart account**        | Soroban contract account — Ancore AA model (not classic G-address only)             |
| **Session key**          | Contract-scoped signing key (extension has fuller UI today)                         |
| **XDR**                  | Stellar binary serialization for transactions                                       |
| **WalletConnect**        | dApp protocol v2 via `@reown/walletkit` — see `src/providers/WalletKitProvider.tsx` |
| **Payment URI**          | SEP-7-style deep link parsing in `src/linking/paymentUri.ts`                        |
| **Biometric lockout**    | Rate-limited biometric attempts via `biometric-lockout-manager.ts`                  |

## Documentation

- [Freighter vs Ancore comparison](../../docs/wallets/FREIGHTER_COMPARISON.md) — note: README mentions Expo; package is currently a **TypeScript library** built with `tsc`
- [Freighter vs Ancore comparison](../../docs/wallets/FREIGHTER_COMPARISON.md)
- [Contributing (monorepo)](../../CONTRIBUTING.md)
- [System architecture](../../docs/architecture/OVERVIEW.md)
- Freighter Mobile reference: [AGENTS.md](https://github.com/stellar/freighter-mobile/blob/main/AGENTS.md), [WC RPC methods](https://github.com/stellar/freighter-mobile/blob/main/docs/walletconnect-rpc-methods.md)

## Quick Reference

| Item            | Value                                                                  |
| --------------- | ---------------------------------------------------------------------- |
| Package         | `@ancore/mobile-wallet`                                                |
| Language        | TypeScript, React 18                                                   |
| Node            | >= 20 (monorepo)                                                       |
| Package Manager | pnpm 9 (workspace)                                                     |
| Build           | `tsc` → `dist/`                                                        |
| Testing         | Jest 29 (jsdom), colocated `__tests__/`                                |
| Linting         | ESLint 9                                                               |
| Host app        | **Not in repo yet** — no `ios/` / `android/` (unlike Freighter Mobile) |
| Default Branch  | `main`                                                                 |

## Build & Test Commands

From repo root:

```bash
corepack pnpm --filter @ancore/mobile-wallet build
corepack pnpm --filter @ancore/mobile-wallet test
corepack pnpm --filter @ancore/mobile-wallet lint
corepack pnpm --filter @ancore/mobile-wallet test:ci   # build + test
```

From `apps/mobile-wallet/`:

```bash
corepack pnpm build
corepack pnpm test
```

## Environment

See `.env.example`. Central config: `src/config/environment.ts`.

| Variable                 | Purpose                                                      |
| ------------------------ | ------------------------------------------------------------ |
| Indexer URL              | Transaction history (pass to `createIndexerActivityAdapter`) |
| Relayer URL              | Future send/submit flows                                     |
| Network                  | mainnet / testnet / futurenet                                |
| WALLETCONNECT_PROJECT_ID | WalletConnect Cloud project ID for dApp connections          |

**Gap:** Indexer URL is often passed ad hoc to adapters — centralize like Freighter’s `config/constants.ts` when adding a host app.

## Repository Structure

```
apps/mobile-wallet/
├── src/
│   ├── index.ts               # Public exports (screens, security, hooks)
│   ├── app/                   # Bootstrap helpers
│   ├── navigation/            # MobileWalletShell, onboarding navigator
│   ├── screens/
│   │   ├── onboarding/        # Create / import / recover (scaffold)
│   │   ├── history/           # Paginated history + indexer adapter
│   │   └── unlock/            # Biometric + password fallback
│   ├── security/
│   │   ├── mobile-secure-vault.ts
│   │   ├── platform-adapters.ts   # WebAuthn placeholder — needs native RN adapter
│   │   └── hooks/useBiometricUnlock.ts
│   ├── storage/               # Secure store adapter interface
│   ├── sdk/                   # Read-only mobile wallet client
│   ├── linking/               # Payment URI parsing + WalletConnect deep links
│   ├── providers/             # WalletKitProvider, Stellar RPC handlers
│   ├── components/            # History list, lockout banner, SessionApprovalSheet
│   └── config/                # environment.ts
├── jest.config.cjs
└── .env.example
```

**Planned (Freighter Mobile parity):**

```
ios/ android/                  # Native host app + dual bundle IDs
e2e/flows/                     # Maestro YAML
fastlane/                      # Store release automation
```

## Architecture

Library-first layout — consumers import from `@ancore/mobile-wallet`:

```typescript
import {
  MobileWalletShell,
  MobileSecureVault,
  createIndexerActivityAdapter,
} from '@ancore/mobile-wallet';
```

**State:** React context + hooks (onboarding navigator). Freighter Mobile uses **Zustand ducks** (`src/ducks/`) — consider migrating when the host app grows.

**History flow:**

```
HistoryScreen → usePaginatedTransactionHistory → TransactionHistoryAdapter
                                                      └─ createIndexerActivityAdapter(indexerUrl, accountId)
```

**Vault tiers (target — Freighter pattern):**

| Tier      | Storage             | Contents                                  |
| --------- | ------------------- | ----------------------------------------- |
| Secure    | Keychain / Keystore | Mnemonic, hash key, encrypted blobs       |
| Biometric | Keychain            | Password blob for biometric unlock        |
| Data      | AsyncStorage        | Account metadata, prefs — **never seeds** |

**Today:** `KeychainSecureStoreAdapter` (`react-native-keychain`) for production, `MemorySecureStoreAdapter` for tests. Pick via `createSecureStoreAdapter()`. Tier rules: [docs/secure-storage.md](./docs/secure-storage.md). Device cold-start QA needs the host app (#780).

**Vault duplication gap:** `MobileSecureVault` parallels `@ancore/core-sdk` `SecureStorageManager` but is not shared with the extension. Unify before shipping.

## Security-Sensitive Areas

| Area            | Path                                                         | Notes                                                       |
| --------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| Vault           | `src/security/mobile-secure-vault.ts`                        | PBKDF2 100k iterations, AES-GCM                             |
| Storage adapter | `src/storage/mobile-secure-storage-adapter.ts`               | Swap memory adapter for Keychain in prod                    |
| Biometrics      | `src/security/platform-adapters.ts`, `useBiometricUnlock.ts` | Native adapter required for RN                              |
| Lockout         | `src/security/biometric-lockout-manager.ts`                  | Do not weaken rate limits                                   |
| Onboarding      | `src/screens/onboarding/`                                    | Must call core-sdk create/import — not name-only scaffold   |
| Deep links      | `src/linking/`                                               | Validate payment URIs; future WC URIs are injection surface |

**Rules (from Freighter Mobile, adapted):**

- Never store mnemonics or private keys in AsyncStorage.
- Use secure clipboard patterns for sensitive copy (add `SecureClipboardService` equivalent).
- Jailbreak/root detection before mainnet release (`jail-monkey` or equivalent).
- WalletConnect sessions (when added) require Blockaid or equivalent scan on connect + sign.

## Known Complexity / Gotchas

- **Not a shippable app:** No native projects, Fastlane, or Maestro — library only. README Expo instructions are outdated.
- **Onboarding scaffold:** `WalletCreateScreen` collects display name only — does not generate keys. Wire to `@ancore/core-sdk` before any real use.
- **WebAuthn biometrics:** `platform-adapters.ts` is web-oriented; React Native needs `react-native-biometrics` + Keychain.
- **Read-only SDK client:** `createMobileWalletSdkClient()` — no sign/send yet.
- **No WalletConnect:** Freighter Mobile’s primary dApp path — largest mobile gap.
- **Dual vault implementations:** Mobile vault vs extension `SecureStorageManager` — consolidate to one abstraction.
- **Test runner:** Uses Jest (`jest.config.cjs`); `vitest.config.ts` also exists — prefer Jest for this package unless migrating.

## Pre-submission Checklist

```bash
corepack pnpm --filter @ancore/mobile-wallet lint
corepack pnpm --filter @ancore/mobile-wallet test:ci
```

Manual checks:

- [ ] No secrets in test fixtures committed to repo
- [ ] Storage adapter tests use memory adapter only in `__tests__`
- [ ] New exports added to `src/index.ts` with types
- [ ] Indexer adapter changes include unit tests in `screens/history/__tests__/`

## Best Practices Entry Points

| Concern                 | Entry Point                                                                                                             | When to Read                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Freighter parity & gaps | [docs/wallets/FREIGHTER_COMPARISON.md](../../docs/wallets/FREIGHTER_COMPARISON.md)                                      | WC, Keychain, host app, onboarding |
| History pagination      | `screens/history/usePaginatedTransactionHistory.ts`                                                                     | New history features               |
| Indexer adapter         | `screens/history/indexerActivityAdapter.ts`                                                                             | API shape changes                  |
| Core vault (extension)  | `packages/core-sdk/src/storage/secure-storage-manager.ts`                                                               | Unifying mobile + extension vault  |
| Freighter Mobile WC     | [walletconnect-rpc-methods.md](https://github.com/stellar/freighter-mobile/blob/main/docs/walletconnect-rpc-methods.md) | Designing WC integration           |
| Freighter Mobile e2e    | [e2e/README.md](https://github.com/stellar/freighter-mobile/blob/main/e2e/README.md)                                    | Maestro setup (future)             |

## Public Exports

Primary entry: `src/index.ts` — screens, navigation shell, security primitives, history hooks/adapters.

When adding features, export stable types from the package root; keep internal test utilities out of `index.ts`.

## Related Packages

| Package                       | Role                                                     |
| ----------------------------- | -------------------------------------------------------- |
| `@ancore/core-sdk`            | Wallet create/import (should drive onboarding)           |
| `@ancore/types`               | Shared types                                             |
| `@ancore/stellar`             | Future sign/submit                                       |
| `@ancore/account-abstraction` | Smart account + session keys (extension ahead of mobile) |
