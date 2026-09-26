# Mobile App Release Process

This document outlines the release lifecycle for `@ancore/mobile-app`, covering
standard releases and emergency hotfixes. Pattern follows
[Freighter Mobile RELEASE.md](https://github.com/stellar/freighter-mobile/blob/main/RELEASE.md).

## Table of Contents

1. [Regular Release Flow](#regular-release-flow)
2. [Emergency Release Flow](#emergency-release-flow)
3. [Post-Tag Manual Steps](#post-tag-manual-steps)
4. [Version Bump](#version-bump)
5. [CI Secrets and Variables](#ci-secrets-and-variables)
6. [Workflow Reference](#workflow-reference)

## Regular Release Flow

Regular mobile releases are cut from `main` on the monorepo release branch.

```ascii
[ main ]
   |
   +-- (1) Bump version via scripts/set-app-version.mjs
   |
   +-- (2) Merge release PR to main / release branch
   |
   +-- (3) Tag mobile-vX.Y.Z
       |
       +-- (4) mobile-app-release.yml (iOS + Android)
           |
           +-- TestFlight (dev/prod scheme)
           +-- Play internal track (dev/prod flavor)
```

### Steps

1. Ensure `main` is green and the release checklist in `docs/release/checklist.md` is complete.
2. Bump the mobile app version (single source of truth):
   ```bash
   node apps/mobile-app/scripts/set-app-version.mjs 0.2.0
   ```
3. Commit the version bump on your release branch and merge.
4. Create and push the mobile release tag:
   ```bash
   git tag -a mobile-v0.2.0 -m "Mobile release v0.2.0"
   git push origin mobile-v0.2.0
   ```
5. Monitor **Actions → Mobile App Release** for iOS and Android jobs.

Tag pushes use `build_env=prod` by default. For internal QA before a prod tag,
run the workflow manually with `build_env=dev`.

## Emergency Release Flow

Emergency (hotfix) releases branch from the last shipped mobile tag, not `main`.

```ascii
[ mobile-vX.Y.Z (tag) ]
   |
   +-- (1) git checkout -b emergency/mobile-vX.Y.Z+1 <tag>
   |
   +-- (2) Cherry-pick / fix on branch
   |
   +-- (3) Bump patch version
   |
   +-- (4) Tag mobile-vX.Y.Z+1
       |
       +-- (5) mobile-app-release.yml
```

### Steps

1. Create a hotfix branch from the last production mobile tag:
   ```bash
   git checkout -b emergency/mobile-v0.1.1 mobile-v0.1.0
   ```
2. Apply the fix and bump the patch version:
   ```bash
   node apps/mobile-app/scripts/set-app-version.mjs 0.1.1
   ```
3. Open a PR targeting `main` (or merge per team policy) and tag after merge:
   ```bash
   git tag -a mobile-v0.1.1 -m "Mobile hotfix v0.1.1"
   git push origin mobile-v0.1.1
   ```
4. Manually trigger **Mobile App Release** if you need a dev build for QA before
   tagging prod (`build_env=dev`, `upload_*=no` for build-only).

## Post-Tag Manual Steps

1. Verify TestFlight and Play Console show the new build.
2. Run Maestro smoke flows against the TestFlight / internal build.
3. Promote Play internal → closed testing / production manually in Play Console.
4. Submit TestFlight build for App Store review when ready (manual in App Store Connect).
5. Announce in team channels with build numbers and tag name.

## Version Bump

`scripts/set-app-version.mjs` keeps these files in sync:

| File                                         | Field                                                        |
| -------------------------------------------- | ------------------------------------------------------------ |
| `package.json`                               | `version`                                                    |
| `android/app/build.gradle`                   | `versionName`                                                |
| `ios/AncoreWallet.xcodeproj/project.pbxproj` | `MARKETING_VERSION` (Info plists use `$(MARKETING_VERSION)`) |

CI sets `versionCode` / `CURRENT_PROJECT_VERSION` from `BUILD_VERSION` (GitHub run number) at build time via Fastlane.

## CI Secrets and Variables

Configure in the GitHub repository before the first store upload.
Step-by-step setup: [scripts/bootstrap-github-secrets.md](./scripts/bootstrap-github-secrets.md).

### Secrets

| Name                             | Purpose                         |
| -------------------------------- | ------------------------------- |
| `APPLE_CONNECT_KEY_ID`           | App Store Connect API key ID    |
| `APPLE_CONNECT_ISSUER_ID`        | App Store Connect issuer ID     |
| `APPLE_CONNECT_KEY_CONTENT`      | Base64 `.p8` key content        |
| `FASTLANE_MATCH_PASSWORD`        | Match encryption password       |
| `FASTLANE_MATCH_GIT_TOKEN`       | PAT for Match certificates repo |
| `ANDROID_DEV_KEYSTORE_CONTENT`   | Base64 dev release keystore     |
| `ANDROID_PROD_KEYSTORE_CONTENT`  | Base64 prod release keystore    |
| `ANDROID_DEV_KEYSTORE_PASSWORD`  | Dev keystore password           |
| `ANDROID_PROD_KEYSTORE_PASSWORD` | Prod keystore password          |

### Variables

| Name                             | Purpose                                                            |
| -------------------------------- | ------------------------------------------------------------------ |
| `FASTLANE_GIT_URL`               | `https://github.com/ancore-org/ancore-mobile-fastlane` (cert repo) |
| `ANDROID_DEV_KEYSTORE_ALIAS`     | Dev key alias                                                      |
| `ANDROID_PROD_KEYSTORE_ALIAS`    | Prod key alias                                                     |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | WIF provider for Play upload                                       |
| `GCP_SERVICE_ACCOUNT_EMAIL`      | Play Console service account                                       |

## Workflow Reference

| File                                       | Purpose                                     |
| ------------------------------------------ | ------------------------------------------- |
| `.github/workflows/mobile-app-release.yml` | Tag / manual → TestFlight + Play internal   |
| `fastlane/Fastfile`                        | `ios dev/prod` and `android dev/prod` lanes |
| `fastlane/Matchfile`                       | Code signing via Match                      |
| `scripts/set-app-version.mjs`              | Cross-platform marketing version sync       |
| `scripts/generate-release-notes.sh`        | Changelog for store uploads                 |
| `scripts/gh-mobile-env.sh`                 | CI env wiring                               |

### Local Fastlane (maintainers)

```bash
cd apps/mobile-app
bundle install
cd ios && pod install && cd ..

# Set required env vars (see Fastfile), then:
bundle exec fastlane ios dev
bundle exec fastlane android dev
```

Bundle IDs:

| Variant | iOS                     | Android                 |
| ------- | ----------------------- | ----------------------- |
| Dev     | `org.ancore.wallet.dev` | `org.ancore.wallet.dev` |
| Prod    | `org.ancore.wallet`     | `org.ancore.wallet`     |

Dev and prod can be installed side-by-side with isolated Keychain / Keystore storage.
