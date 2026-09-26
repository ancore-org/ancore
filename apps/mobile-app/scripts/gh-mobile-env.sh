#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

BUILD_ENV="${1:-dev}"
UPLOAD_IOS="${UPLOAD_TO_TESTFLIGHT:-yes}"
UPLOAD_ANDROID="${UPLOAD_TO_GOOGLE_PLAY:-yes}"

if [[ "${BUILD_ENV}" == "prod" ]]; then
  export IOS_SCHEME="AncoreWallet"
  export ANDROID_FLAVOR="prod"
  export FASTLANE_LANE="prod"
  export APP_ID="org.ancore.wallet"
  export APP_NAME="Ancore Wallet"
else
  export IOS_SCHEME="AncoreWallet-Dev"
  export ANDROID_FLAVOR="dev"
  export FASTLANE_LANE="dev"
  export APP_ID="org.ancore.wallet.dev"
  export APP_NAME="Ancore Wallet Dev"
fi

if [[ -f "${ROOT_DIR}/package.json" ]]; then
  APP_VERSION="$(node -p "require('${ROOT_DIR}/package.json').version")"
else
  APP_VERSION="0.0.0"
fi

if [[ -n "${GITHUB_RUN_NUMBER:-}" ]]; then
  BUILD_VERSION="${GITHUB_RUN_NUMBER}"
elif [[ -n "${BUILD_VERSION:-}" ]]; then
  BUILD_VERSION="${BUILD_VERSION}"
else
  BUILD_VERSION="$(date +%s)"
fi

if [[ -f "${ROOT_DIR}/.release-notes.txt" ]]; then
  RELEASE_NOTES="$(cat "${ROOT_DIR}/.release-notes.txt")"
else
  RELEASE_NOTES="Ancore Wallet ${APP_VERSION} (${BUILD_ENV})"
fi

{
  echo "UPLOAD_TO_TESTFLIGHT=${UPLOAD_IOS}"
  echo "UPLOAD_TO_GOOGLE_PLAY=${UPLOAD_ANDROID}"
  echo "BUILD_VERSION=${BUILD_VERSION}"
  echo "APP_VERSION=${APP_VERSION}"
  echo "APP_ID=${APP_ID}"
  echo "APP_NAME=${APP_NAME}"
  echo "IOS_SCHEME=${IOS_SCHEME}"
  echo "ANDROID_FLAVOR=${ANDROID_FLAVOR}"
  echo "FASTLANE_LANE=${FASTLANE_LANE}"
  echo "RELEASE_NOTES<<EOF"
  echo "${RELEASE_NOTES}"
  echo "EOF"
} >> "${GITHUB_ENV:-/dev/null}"
