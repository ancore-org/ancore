#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${ROOT_DIR}/../.." && pwd)"

cd "${REPO_ROOT}"
corepack pnpm --filter @ancore/mobile-wallet build

cd "${ROOT_DIR}/android"
chmod +x gradlew
./gradlew :app:assembleDevDebug --no-daemon
