# Ancore

> Stellar-native account abstraction stack: Soroban smart account contract, SDKs, relayer, indexer, and wallet apps.
> Wallet engineering standards are benchmarked against SDF [Freighter](https://github.com/stellar/freighter) (extension) and [Freighter Mobile](https://github.com/stellar/freighter-mobile) — see [docs/wallets/FREIGHTER_COMPARISON.md](docs/wallets/FREIGHTER_COMPARISON.md).

## Wallet AGENTS guides

| App               | AGENTS.md                                                          | Freighter reference                                                                           |
| ----------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Browser extension | [apps/extension-wallet/AGENTS.md](apps/extension-wallet/AGENTS.md) | [freighter/AGENTS.md](https://github.com/stellar/freighter/blob/master/AGENTS.md)             |
| Mobile (library)  | [apps/mobile-wallet/AGENTS.md](apps/mobile-wallet/AGENTS.md)       | [freighter-mobile/AGENTS.md](https://github.com/stellar/freighter-mobile/blob/main/AGENTS.md) |

Read the app-specific AGENTS file before changing popup/background, vault, messaging, onboarding, or mobile security code.

**Contributors:** see the priority roadmap in [docs/wallets/FREIGHTER_COMPARISON.md](docs/wallets/FREIGHTER_COMPARISON.md#9-priority-roadmap-recommended-order).

## Monorepo quick reference

| Item            | Value                                         |
| --------------- | --------------------------------------------- |
| Node            | >= 20                                         |
| Package manager | pnpm 9 (`corepack pnpm` on Windows if needed) |
| Rust / Soroban  | Contracts in `contracts/account/`             |
| Default branch  | `main`                                        |

```bash
corepack pnpm install
corepack pnpm build
corepack pnpm test
corepack pnpm lint
corepack pnpm typecheck
```

## Key paths

```
ancore/
├── apps/
│   ├── extension-wallet/    # MV3 extension (see AGENTS.md)
│   ├── mobile-wallet/       # Mobile library (see AGENTS.md)
│   └── web-dashboard/
├── packages/
│   ├── core-sdk/            # SecureStorageManager, wallet APIs
│   ├── wallet-shared/       # dApp protocol, network constants
│   ├── wallet-api/          # @ancore/wallet-api for dApps
│   ├── account-abstraction/ # Smart account client, session keys
│   ├── crypto/              # BIP39, HD, signing
│   └── stellar/             # Horizon / RPC helpers
├── contracts/account/       # Soroban smart account WASM
├── services/
│   ├── relayer/
│   └── indexer/
├── docs/
    ├── architecture/WALLET_EXTENSION.md
    └── wallets/FREIGHTER_COMPARISON.md
```

## Security-sensitive (repo-wide)

- `packages/core-sdk/` — vault and wallet lifecycle
- `packages/crypto/` — key material handling
- `contracts/account/` — on-chain permissions and session keys
- `apps/extension-wallet/src/background/` — extension signing surface
- `apps/mobile-wallet/src/security/` — mobile vault and biometrics

Full contributor security tiers: [CONTRIBUTING.md](CONTRIBUTING.md#security-boundaries).

## Documentation index

[docs/README.md](docs/README.md)
