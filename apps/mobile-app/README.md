# @ancore/mobile-app

React Native host app for the Ancore mobile wallet.

## Prerequisites

- Node.js >= 20
- pnpm 9
- Xcode 15+ (iOS)
- Android Studio (Android)
- CocoaPods >= 1.15 (`sudo gem install cocoapods`)

## Getting started

```bash
# Install dependencies from monorepo root
corepack pnpm install

# Install iOS CocoaPods
cd apps/mobile-app/ios && pod install && cd -

# Start Metro bundler
corepack pnpm --filter @ancore/mobile-app start

# Launch on iOS 17+ simulator
corepack pnpm --filter @ancore/mobile-app ios

# Launch on Android emulator
corepack pnpm --filter @ancore/mobile-app android
```

## Scripts

| Command              | Description                                               |
| -------------------- | --------------------------------------------------------- |
| `pnpm start`         | Start Metro bundler                                       |
| `pnpm ios`           | Run dev scheme on iOS simulator (`org.ancore.wallet.dev`) |
| `pnpm android`       | Run dev flavor on Android emulator                        |
| `pnpm ios:prod`      | Run prod scheme on iOS simulator                          |
| `pnpm android:prod`  | Run prod flavor on Android emulator                       |
| `pnpm set-version`   | Sync version across package.json and native projects      |
| `pnpm build:ios`     | Build iOS release bundle                                  |
| `pnpm build:android` | Build Android release bundle                              |
| `pnpm lint`          | ESLint source                                             |
| `pnpm test`          | Jest unit tests                                           |

## Architecture

This host app imports and renders the `@ancore/mobile-wallet` library.
The entry screen is the `OnboardingNavigator` from the library package.

```
index.js → App.tsx → OnboardingNavigator (@ancore/mobile-wallet)
```

## Bundle IDs

| Variant | iOS                   | Android               |
| ------- | --------------------- | --------------------- |
| Dev     | org.ancore.wallet.dev | org.ancore.wallet.dev |
| Prod    | org.ancore.wallet     | org.ancore.wallet     |

Dual bundle IDs allow side-by-side dev and prod installs with isolated Keychain stores.

## Store release

Fastlane lanes upload to TestFlight (iOS) and Play internal (Android). See
[RELEASE.md](./RELEASE.md) for the full runbook.

```bash
# Sync marketing version across native projects
pnpm set-version 0.2.0

# Tag to trigger CI (from repo root)
git tag -a mobile-v0.2.0 -m "Mobile release v0.2.0"
git push origin mobile-v0.2.0
```
