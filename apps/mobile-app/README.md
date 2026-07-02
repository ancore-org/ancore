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

| Command              | Description                  |
| -------------------- | ---------------------------- |
| `pnpm start`         | Start Metro bundler          |
| `pnpm ios`           | Run on iOS simulator         |
| `pnpm android`       | Run on Android emulator      |
| `pnpm build:ios`     | Build iOS release bundle     |
| `pnpm build:android` | Build Android release bundle |
| `pnpm lint`          | ESLint source                |
| `pnpm test`          | Jest unit tests              |

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
