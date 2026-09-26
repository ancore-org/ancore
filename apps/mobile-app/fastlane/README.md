## fastlane documentation

Fastlane lanes for Ancore Wallet mobile store uploads.

### Setup

```bash
cd apps/mobile-app
bundle install
cd ios && pod install && cd ..
```

### Lanes

| Lane           | Platform | Output                                  |
| -------------- | -------- | --------------------------------------- |
| `ios dev`      | iOS      | TestFlight (`org.ancore.wallet.dev`)    |
| `ios prod`     | iOS      | TestFlight (`org.ancore.wallet`)        |
| `android dev`  | Android  | Play internal (`org.ancore.wallet.dev`) |
| `android prod` | Android  | Play internal (`org.ancore.wallet`)     |

### Required environment variables

See [RELEASE.md](../RELEASE.md#ci-secrets-and-variables).

```bash
bundle exec fastlane ios dev
bundle exec fastlane android dev
```
