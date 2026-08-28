#!/usr/bin/env node
// Syncs apps/mobile-app/package.json's `version` — the single source of
// truth for the mobile app's release version — into the native iOS and
// Android projects. Run before every release build (wired into
// fastlane/Fastfile's `sync_version` lane and the release CI workflow), and
// safe to run locally / repeatedly (idempotent for the version strings;
// only the iOS build number auto-increments — see below).
//
//   node scripts/sync-native-version.js
//   node scripts/sync-native-version.js --check   # verify only, exit 1 on drift, no writes

const { readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const MOBILE_APP_ROOT = path.resolve(__dirname, '..');
const PBXPROJ_PATH = path.join(MOBILE_APP_ROOT, 'ios/AncoreWallet.xcodeproj/project.pbxproj');
const BUILD_GRADLE_PATH = path.join(MOBILE_APP_ROOT, 'android/app/build.gradle');

const checkOnly = process.argv.includes('--check');

function readMobileVersion() {
  const pkg = JSON.parse(readFileSync(path.join(MOBILE_APP_ROOT, 'package.json'), 'utf8'));
  const version = pkg.version;
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(
      `apps/mobile-app/package.json version "${version}" is not a plain semver X.Y.Z (pre-release/build metadata suffixes aren't valid store version strings)`
    );
  }
  return version;
}

/**
 * Android versionCode must be a monotonically increasing 32-bit integer
 * across all releases ever shipped to Play. Deriving it from semver
 * (major*10000 + minor*100 + patch) keeps it deterministic and reproducible
 * from package.json alone, with no state to track between runs — as long
 * as each part stays within its digit budget (minor/patch < 100), which is
 * enforced below rather than silently overflowing/colliding.
 */
function versionCodeFromSemver(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (minor > 99 || patch > 99) {
    throw new Error(
      `versionCodeFromSemver: minor/patch must stay below 100 to fit the derived versionCode scheme (got ${version}) — bump major instead, or revisit this scheme`
    );
  }
  return major * 10000 + minor * 100 + patch;
}

function syncIos(version) {
  const source = readFileSync(PBXPROJ_PATH, 'utf8');
  const currentMatch = source.match(/MARKETING_VERSION = ([^;]+);/);
  const currentVersion = currentMatch ? currentMatch[1] : null;

  const buildNumberMatches = [...source.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)];
  const currentBuildNumber = buildNumberMatches.length
    ? Math.max(...buildNumberMatches.map((m) => Number(m[1])))
    : 0;

  if (checkOnly) {
    return currentVersion === version;
  }

  // Marketing version: set to match package.json exactly, in every
  // build configuration (Debug and Release both declare it).
  let next = source.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`);

  // Build number: only bump when the marketing version actually changed,
  // so re-running this script for an unrelated reason doesn't burn a
  // build number. TestFlight requires a strictly increasing build number
  // even across the same marketing version, so this is a floor, not a
  // guarantee of uniqueness — CI should still fail loudly on a duplicate
  // upload rather than silently retry with a bumped number.
  if (currentVersion !== version) {
    const nextBuildNumber = currentBuildNumber + 1;
    next = next.replace(
      /CURRENT_PROJECT_VERSION = \d+;/g,
      `CURRENT_PROJECT_VERSION = ${nextBuildNumber};`
    );
  }

  writeFileSync(PBXPROJ_PATH, next);
  return true;
}

function syncAndroid(version) {
  const source = readFileSync(BUILD_GRADLE_PATH, 'utf8');
  const currentMatch = source.match(/versionName\s+"([^"]+)"/);
  const currentVersion = currentMatch ? currentMatch[1] : null;
  const versionCode = versionCodeFromSemver(version);

  if (checkOnly) {
    const currentCodeMatch = source.match(/versionCode\s+(\d+)/);
    const currentCode = currentCodeMatch ? Number(currentCodeMatch[1]) : null;
    return currentVersion === version && currentCode === versionCode;
  }

  const next = source
    .replace(/versionName\s+"[^"]+"/, `versionName "${version}"`)
    .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);

  writeFileSync(BUILD_GRADLE_PATH, next);
  return true;
}

function main() {
  const version = readMobileVersion();
  const iosOk = syncIos(version);
  const androidOk = syncAndroid(version);

  if (checkOnly) {
    if (iosOk && androidOk) {
      console.log(`Native projects already match package.json version ${version}.`);
      return;
    }
    console.error(
      `Native project versions are out of sync with package.json (${version}). Run \`node scripts/sync-native-version.js\`.`
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Synced native projects to version ${version} (Android versionCode ${versionCodeFromSemver(version)}).`
  );
}

main();
