# Ancore Mobile App

> React Native **host app** for `@ancore/mobile-wallet`. Ships to TestFlight and
> Play internal via Fastlane. Benchmark: [Freighter Mobile](https://github.com/stellar/freighter-mobile).

## Quick reference

| Item            | Value                                           |
| --------------- | ----------------------------------------------- |
| Package         | `@ancore/mobile-app`                            |
| iOS schemes     | `AncoreWallet-Dev` (dev), `AncoreWallet` (prod) |
| Android flavors | `dev`, `prod`                                   |
| Dev bundle ID   | `org.ancore.wallet.dev`                         |
| Prod bundle ID  | `org.ancore.wallet`                             |
| Release runbook | [RELEASE.md](./RELEASE.md)                      |
| Library         | [apps/mobile-wallet](../mobile-wallet/)         |

## Build & run

From repo root:

```bash
corepack pnpm install
cd apps/mobile-app/ios && pod install && cd -

corepack pnpm --filter @ancore/mobile-app start
corepack pnpm --filter @ancore/mobile-app ios        # dev scheme
corepack pnpm --filter @ancore/mobile-app android    # dev flavor
```

## Release engineering

| Path                                       | Purpose                                |
| ------------------------------------------ | -------------------------------------- |
| `fastlane/Fastfile`                        | TestFlight + Play internal lanes       |
| `scripts/set-app-version.mjs`              | Version sync (`package.json` ↔ native) |
| `.github/workflows/mobile-app-release.yml` | Tag `mobile-v*.*.*` → store upload     |

Before cutting a release, read [RELEASE.md](./RELEASE.md) and
[docs/release/mobile.md](../../docs/release/mobile.md).

## Security-sensitive

- `android/keystores/` — release signing material (never commit `.keystore` files)
- Fastlane Match cert repo — separate private repository
- Dev/prod bundle ID isolation — required for Keychain/Keystore separation

## Related

- [mobile-wallet AGENTS.md](../mobile-wallet/AGENTS.md) — library security and WC
- [FREIGHTER_COMPARISON.md](../../docs/wallets/FREIGHTER_COMPARISON.md) §6.1
