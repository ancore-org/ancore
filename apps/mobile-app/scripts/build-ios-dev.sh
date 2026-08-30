#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${ROOT_DIR}/../.." && pwd)"

cd "${REPO_ROOT}"
corepack pnpm --filter @ancore/mobile-wallet build

cd "${ROOT_DIR}/ios"
pod install

xcodebuild \
  -workspace AncoreWallet.xcworkspace \
  -scheme AncoreWallet-Dev \
  -configuration Debug \
  -sdk iphonesimulator \
  -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO

APP_PATH="${ROOT_DIR}/ios/build/Build/Products/Debug-iphonesimulator/AncoreWallet.app"

if [[ ! -d "${APP_PATH}" ]]; then
  echo "Expected app bundle at ${APP_PATH}"
  exit 1
fi

echo "APP_PATH=${APP_PATH}" >> "${GITHUB_ENV:-/dev/null}"
