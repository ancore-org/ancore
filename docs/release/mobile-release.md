# Mobile Release Runbook

Release engineering for `apps/mobile-app` (iOS TestFlight + Android Play
internal track). This is a separate release train from
[`runbook.md`](./runbook.md) (contracts/backend, `v*.*.*` tags) — mobile
ships on its own cadence, versioned from `apps/mobile-app/package.json`, on
`mobile-v*.*.*` tags.

---

## Prerequisites

- Write access to the `ancore` repository.
- An Apple Developer Program membership and access to the Google Play
  Console for `org.ancore.wallet`.
- The following GitHub Actions secrets configured on the repository
  (`.github/workflows/mobile-release.yml` reads all of these):

  | Secret | Purpose |
  | --- | --- |
  | `ASC_API_KEY_CONTENT` | Base64-encoded App Store Connect API key (`.p8`) — used for `upload_to_testflight`. |
  | `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_TEAM_ID` | App Store Connect API key metadata. |
  | `MATCH_GIT_URL` | Git URL of the private repo holding signing certs/profiles (`fastlane match`). |
  | `MATCH_PASSWORD` | Passphrase `match` uses to encrypt/decrypt that repo's contents. |
  | `MATCH_GIT_BASIC_AUTHORIZATION` | HTTP basic auth (base64 `user:token`) for `match`'s git repo, if it isn't reachable via the runner's default SSH key. |
  | `ANCORE_RELEASE_STORE_FILE_CONTENT` | Base64-encoded Android release keystore (`.jks`/`.keystore`). |
  | `ANCORE_RELEASE_STORE_PASSWORD`, `ANCORE_RELEASE_KEY_ALIAS`, `ANCORE_RELEASE_KEY_PASSWORD` | That keystore's password/alias/key password. |
  | `GOOGLE_PLAY_JSON_KEY_CONTENT` | Raw JSON content of a Play Console service account key with Release Manager access. |

  None of these exist in this repository or this environment — they're
  operator-provisioned. Every lane that needs one fails loudly
  (`UI.user_error!`/an explicit non-zero exit) rather than silently
  falling back to something unsigned or debug-signed.

- Local toolchain (only needed for a manual/local release — CI installs all
  of this itself): `node ≥ 20`, `pnpm ≥ 9`, Xcode 15+, CocoaPods, a JDK 17,
  Ruby + Bundler (`cd fastlane && bundle install`).

## What already exists vs. what this adds

`org.ancore.wallet.dev` (debug) vs. `org.ancore.wallet` (release) bundle
ID/package name isolation was already correct at the native-project level
before this change — see `apps/mobile-app/ios/AncoreWallet.xcodeproj` (Debug
vs. Release build configuration) and
`apps/mobile-app/android/app/build.gradle` (`applicationIdSuffix ".dev"` on
the `debug` build type). This change wires the actually-missing pieces: a
shared, CI-visible Xcode scheme; real Android release signing (previously
the `release` build type silently reused the *debug* keystore — see the
signing config in `build.gradle`); `fastlane/Fastfile`'s `beta` lanes
(build → sign → upload); the version-sync script; and this runbook + the CI
workflow.

## 1. Cut a release

1. Confirm `apps/mobile-app/package.json`'s `version` is what you intend to
   ship (bump it in that release's PR, not on `main` directly after the
   fact).
2. Tag from `main`:
   ```bash
   git checkout main && git pull origin main
   git tag mobile-v$(node -p "require('./apps/mobile-app/package.json').version")
   git push origin mobile-v$(node -p "require('./apps/mobile-app/package.json').version")
   ```
   This triggers `.github/workflows/mobile-release.yml`, which runs both
   platforms.
3. To release just one platform, or to do a dry run first (builds and
   signs, skips the store upload), use **Actions → Mobile Release → Run
   workflow** instead of tagging, and set `platform`/`dry_run` there.

## 2. What each release job does

Both jobs (`release-ios`, `release-android`) run, in order:

1. `sync_version` — writes `apps/mobile-app/package.json`'s version into
   the native projects (`MARKETING_VERSION`/auto-incremented
   `CURRENT_PROJECT_VERSION` for iOS; `versionName`/derived `versionCode`
   for Android). See `apps/mobile-app/scripts/sync-native-version.js` for
   exactly how each is computed — Android's `versionCode` is deterministic
   from semver, iOS's build number auto-increments only when the marketing
   version actually changed.
2. `e2e_tests` — the existing Maestro quality gate (unchanged; skippable
   locally with `skip_e2e:true`, never skipped in the real CI release path).
3. Build + sign (`match` + `build_app` for iOS; `gradle bundle` with the
   release signing config for Android).
4. Upload (`upload_to_testflight` / `upload_to_play_store`, internal
   track) — skipped when `dry_run` is set.

## 3. Monitoring a release

- Watch the `Mobile Release` workflow run in the Actions tab.
- A TestFlight build needs Apple's own processing time after upload before
  it's installable — `skip_waiting_for_build_processing: true` is set so CI
  doesn't block on that; check App Store Connect directly for processing
  status.
- A Play internal-track upload is available to internal testers
  immediately.

## 4. Hotfix procedure

1. Branch from the release tag, not from `main` (which may have moved on):
   ```bash
   git checkout -b hotfix/mobile-vX.Y.Z+1 mobile-vX.Y.Z
   ```
2. Cherry-pick or make the minimal fix, bump
   `apps/mobile-app/package.json`'s patch version.
3. Open a PR into `main` as usual for review; once merged, tag the new
   patch version from `main` following the normal flow in §1 (do **not**
   tag from the unmerged hotfix branch — the release tag must always point
   at a commit that's actually on `main`).

## 5. Rollback

- **Play internal track**: promote a previous release from the Play
  Console, or halt the current rollout there directly — there is no
  automated rollback lane here (Play doesn't support un-publishing a build
  that's already reached testers).
- **TestFlight**: expire the problematic build from App Store Connect (or
  simply don't promote it) and ship a new build; TestFlight builds also
  can't be un-published once distributed to testers.
- Either way, treat this the same as a hotfix (§4): the fix ships as a new,
  higher version — never by trying to erase the bad one.

## Known gaps / follow-ups

- `.github/workflows/mobile-app-e2e.yml`'s iOS/Android "Build" steps are
  still explicit placeholders (`TODO: Wire native build when
  Xcode/gradle project exists`, `continue-on-error: true`) left over from
  before the native projects existed. Now that they exist, wiring a real
  build into that e2e workflow is a natural follow-up — out of scope here,
  which is specifically the release/store pipeline, not e2e CI.
- Android release signing is isolated via build **type** (debug vs.
  release), not Gradle product **flavors**. That already gives the
  bundle-ID and keystore isolation this issue asked for without touching
  the existing build graph; introducing full flavors (separate `dev`/`prod`
  source sets, resource sets, etc.) is a larger, separate refactor if ever
  needed.
