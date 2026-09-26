#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ -n "${INPUT_RELEASE_NOTES:-}" ]]; then
  printf '%s' "${INPUT_RELEASE_NOTES}" > "${ROOT_DIR}/.release-notes.txt"
  echo "Using provided release notes"
  exit 0
fi

if [[ -n "${GITHUB_REF_NAME:-}" && "${GITHUB_REF_NAME}" =~ ^v[0-9] ]]; then
  TAG="${GITHUB_REF_NAME}"
elif [[ -n "${REF_NAME:-}" && "${REF_NAME}" =~ ^v[0-9] ]]; then
  TAG="${REF_NAME}"
else
  TAG="$(git -C "${ROOT_DIR}/../.." describe --tags --abbrev=0 2>/dev/null || true)"
fi

if [[ -z "${TAG}" ]]; then
  echo "No release tag found; using placeholder release notes"
  printf 'Ancore Wallet mobile build\n' > "${ROOT_DIR}/.release-notes.txt"
  exit 0
fi

PREV_TAG="$(git -C "${ROOT_DIR}/../.." describe --tags --abbrev=0 "${TAG}^" 2>/dev/null || true)"
if [[ -z "${PREV_TAG}" ]]; then
  NOTES="Release ${TAG}"
else
  NOTES="$(git -C "${ROOT_DIR}/../.." log "${PREV_TAG}..${TAG}" --pretty=format:'- %s' -- apps/mobile-app apps/mobile-wallet)"
  if [[ -z "${NOTES}" ]]; then
    NOTES="Release ${TAG}"
  fi
fi

printf '%s' "${NOTES}" > "${ROOT_DIR}/.release-notes.txt"
echo "Generated release notes for ${TAG}"
