#!/usr/bin/env node
// Copies the compiled account contract WASM into public/contracts/ so the
// extension can bundle it and upload it during onboarding deploy
// (see src/services/deploy-account.ts). Building the contract itself is a
// separate step (`pnpm contracts:build` at the repo root, or cargo directly)
// — this script only fails loudly if that hasn't happened yet, rather than
// silently shipping a stale or missing WASM.

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(
  __dirname,
  '../../../contracts/target/wasm32-unknown-unknown/release/ancore_account.optimized.wasm'
);
const DEST = resolve(__dirname, '../public/contracts/ancore_account.wasm');

if (!existsSync(SOURCE)) {
  console.error(
    `[sync-account-wasm] Not found: ${SOURCE}\n` +
      'Build the contract first: cd contracts && cargo build --target wasm32-unknown-unknown --release -p ancore-account ' +
      '&& stellar contract optimize --wasm target/wasm32-unknown-unknown/release/ancore_account.wasm'
  );
  process.exit(1);
}

mkdirSync(dirname(DEST), { recursive: true });
copyFileSync(SOURCE, DEST);
console.log(`[sync-account-wasm] Copied ${SOURCE} -> ${DEST}`);
