# GitHub secrets bootstrap for mobile store releases

Run these steps once per repository before the first `mobile-app-release` workflow.

## 1. Apple (TestFlight)

1. Create an App Store Connect API key (Admin → Users and Access → Keys).
2. Base64-encode the `.p8` file:
   ```bash
   base64 -i AuthKey_XXXXXX.p8 | pbcopy
   ```
3. Add GitHub **secrets**:
   - `APPLE_CONNECT_KEY_ID`
   - `APPLE_CONNECT_ISSUER_ID`
   - `APPLE_CONNECT_KEY_CONTENT` (base64 `.p8`)

## 2. Fastlane Match

1. Create private repo `ancore-org/ancore-mobile-fastlane`.
2. Locally initialize Match (maintainers only):
   ```bash
   cd apps/mobile-app
   bundle install
   bundle exec fastlane match appstore \
     --app_identifier org.ancore.wallet,org.ancore.wallet.dev
   ```
3. Add GitHub **secrets**:
   - `FASTLANE_MATCH_PASSWORD`
   - `FASTLANE_MATCH_GIT_TOKEN` (PAT with repo read access)
4. Add GitHub **variable**:
   - `FASTLANE_GIT_URL` = `https://github.com/ancore-org/ancore-mobile-fastlane`

## 3. Android keystores

Generate dev and prod release keystores (store outside git):

```bash
keytool -genkey -v -keystore dev-release.keystore -alias ancore-dev -keyalg RSA -keysize 2048 -validity 10000
keytool -genkey -v -keystore prod-release.keystore -alias ancore-prod -keyalg RSA -keysize 2048 -validity 10000
```

Base64 and add **secrets**:

- `ANDROID_DEV_KEYSTORE_CONTENT`
- `ANDROID_PROD_KEYSTORE_CONTENT`
- `ANDROID_DEV_KEYSTORE_PASSWORD`
- `ANDROID_PROD_KEYSTORE_PASSWORD`

Add **variables**:

- `ANDROID_DEV_KEYSTORE_ALIAS` = `ancore-dev`
- `ANDROID_PROD_KEYSTORE_ALIAS` = `ancore-prod`

## 4. Google Play (internal track)

1. Create a Play Console service account with release permissions.
2. Configure Workload Identity Federation for GitHub Actions.
3. Add **variables**:
   - `GCP_WORKLOAD_IDENTITY_PROVIDER`
   - `GCP_SERVICE_ACCOUNT_EMAIL`

## 5. Smoke test

```bash
# Manual workflow: Actions → Mobile App Release
# build_env=dev, upload_to_testflight=no, upload_to_google_play=no
```

Verify build artifacts upload successfully before enabling store uploads.
