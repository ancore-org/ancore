# Ancore

> Stellar-native account abstraction stack: Soroban smart account contract, SDKs, relayer, indexer, and wallet apps.
> Wallet engineering standards are benchmarked against SDF [Freighter](https://github.com/stellar/freighter) (extension) and [Freighter Mobile](https://github.com/stellar/freighter-mobile) — see [docs/wallets/FREIGHTER_COMPARISON.md](docs/wallets/FREIGHTER_COMPARISON.md).

## Wallet AGENTS guides

| App               | AGENTS.md                                                          | Freighter reference                                                                           |
| ----------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Browser extension | [apps/extension-wallet/AGENTS.md](apps/extension-wallet/AGENTS.md) | [freighter/AGENTS.md](https://github.com/stellar/freighter/blob/master/AGENTS.md)             |
| Mobile (library)  | [apps/mobile-wallet/AGENTS.md](apps/mobile-wallet/AGENTS.md)       | [freighter-mobile/AGENTS.md](https://github.com/stellar/freighter-mobile/blob/main/AGENTS.md) |

Read the app-specific AGENTS file before changing popup/background, vault, messaging, onboarding, or mobile security code.

**Contributors:** see the priority roadmap in [docs/wallets/FREIGHTER_COMPARISON.md](docs/wallets/FREIGHTER_COMPARISON.md#9-priority-roadmap-recommended-order).

## Monorepo quick reference

| Item            | Value                                         |
| --------------- | --------------------------------------------- |
| Node            | >= 20                                         |
| Package manager | pnpm 9 (`corepack pnpm` on Windows if needed) |
| Rust / Soroban  | Contracts in `contracts/account/`             |
| Default branch  | `main`                                        |

```bash
corepack pnpm install
corepack pnpm build
corepack pnpm test
corepack pnpm lint
corepack pnpm typecheck
```

## Running apps locally

```bash
corepack pnpm dev:extension   # extension-wallet, http://localhost:5173 (or next free port)
corepack pnpm dev:dashboard   # web-dashboard,   http://localhost:5173 (or next free port)
corepack pnpm dev:mobile      # mobile-wallet dev/watch
```

Each app builds its workspace-library dependencies first (`predev`/`prebuild` scripts) — if you see
"Cannot find module '@ancore/...'", run `pnpm --filter <pkg> build` for the missing package, or just
`pnpm build` once at the repo root.

**extension-wallet has two entry points — know which one you're editing:**

| Entry          | File                                          | Served by                                                            | Used for                                |
| -------------- | --------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------- |
| Real extension | `src/popup/index.html` → `src/popup/main.tsx` | Loading the built extension as a Chrome extension (`dist/`)          | The actual product                      |
| Root dev entry | `index.html` → `src/main.tsx`                 | `pnpm dev`, Playwright's `webServer` in `tests/playwright.config.ts` | Local browser testing and all e2e tests |

Both files render the same `ExtensionRouter`, so they must independently import anything that needs to
run before the app's module graph does — most importantly `import './polyfills'` (or `'../polyfills'`
from `popup/`) as the **first** line. If you add a new global polyfill or an early side-effect import,
add it to **both** entries or it will silently work in production and fail in every local/e2e run (or
vice versa). This exact gap ("Buffer is not defined" only when running via `pnpm dev`, never when
loading the packaged extension) was a repeat CI failure — check both files whenever `Buffer`,
`process`, or `global` polyfill code changes.

## Key paths

```
ancore/
├── apps/
│   ├── extension-wallet/    # MV3 extension (see AGENTS.md)
│   ├── mobile-wallet/       # Mobile library (see AGENTS.md)
│   └── web-dashboard/
├── packages/
│   ├── core-sdk/            # SecureStorageManager, wallet APIs
│   ├── wallet-shared/       # dApp protocol, network constants
│   ├── wallet-api/          # @ancore/wallet-api for dApps
│   ├── account-abstraction/ # Smart account client, session keys
│   ├── crypto/              # BIP39, HD, signing
│   └── stellar/             # Horizon / RPC helpers
├── contracts/account/       # Soroban smart account WASM
├── services/
│   ├── relayer/
│   └── indexer/
├── docs/
    ├── architecture/WALLET_EXTENSION.md
    └── wallets/FREIGHTER_COMPARISON.md
```

## Security-sensitive (repo-wide)

- `packages/core-sdk/` — vault and wallet lifecycle
- `packages/crypto/` — key material handling
- `contracts/account/` — on-chain permissions and session keys
- `apps/extension-wallet/src/background/` — extension signing surface
- `apps/mobile-wallet/src/security/` — mobile vault and biometrics

Full contributor security tiers: [CONTRIBUTING.md](CONTRIBUTING.md#security-boundaries).

## Before you push — run what CI runs

CI checks TypeScript/JS and Rust separately, and each has its own format + lint + test gate. Run the
matching block locally before pushing; all four commands must exit 0.

**TypeScript/JS (root):**

```bash
corepack pnpm format:check   # prettier --check — CI job "Format Check"
corepack pnpm lint           # eslint per package/app — CI jobs "Package — *" / "App — *"
corepack pnpm build          # turbo build, all workspaces — required by every app/package CI job
corepack pnpm test           # vitest/jest per package/app
```

Fix formatting with `corepack pnpm format` (not `format:check`) before committing.

**Rust — `contracts/` and `services/indexer/` are separate Cargo workspaces.** Run each block in
**both** directories; passing one does not mean the other passes:

```bash
cd contracts        # or: cd services/indexer
cargo fmt --check   # CI step "Check Rust formatting"
cargo clippy -- -D warnings   # CI step "Run clippy" — warnings fail the build, not just errors
cargo test           # CI step "Test contracts" / "Run tests"
cd -
```

**Repo structure doc check** (only if you added/renamed/removed a top-level module):

```bash
corepack pnpm docs:check-structure
```

**Workflow YAML changes** (`.github/workflows/*.yml`): validate with
[`actionlint`](https://github.com/rhysd/actionlint) (`brew install actionlint`, then
`actionlint .github/workflows/*.yml`) before pushing. GitHub's own web UI does not show a useful error
for schema problems — a broken `release.yml` once failed silently on every push for months, showing
only "This run likely failed because of a workflow file issue" with zero job logs. `actionlint` catches
these (invalid `if:` context references, non-existent step outputs, bad action versions) in seconds.

A green local run of all of the above is not a guarantee — CI also runs on Linux where a handful of
things (headless Chromium, case-sensitive filesystem paths, Postgres-backed indexer tests) behave
differently than macOS. Treat local green as necessary, not sufficient.

## Known pitfalls that have broken CI here

- **Rust dead-code false positives from duplicate module trees.** If a binary crate (`main.rs`)
  redeclares `mod foo;` instead of importing `pub mod foo` from its own `lib.rs`, clippy's dead-code
  lint runs against the **binary's** copy, and anything only reachable from the library half of the
  crate gets flagged as unused — even though it compiles and the same source is genuinely used
  elsewhere. Prefer `use crate_name::foo;` in `main.rs` over redeclaring modules that already exist in
  `lib.rs`.
- **A dependency used by a stub/shim file must be a _direct_ dependency of the app that ships the
  stub**, not just a dependency of the workspace package it's replacing. `apps/*/src/stubs/*.ts` files
  import packages like `bip39` and `@noble/hashes` directly; if an app's `package.json` doesn't declare
  them, pnpm's strict linking makes them unresolvable there even though a sibling package already
  depends on them — this fails at runtime (`Buffer is not defined`, `Cannot find module`), not at
  `pnpm install` time, so it's easy to miss.
- **Vite `optimizeDeps` browser-only `define` overrides (`process.version`, `process.versions`, etc.)
  break under Vitest.** Vitest runs in real Node, where `process.version` is a genuine read-only
  property — overriding it via `define` throws `TypeError: Cannot assign to read only property`. If an
  app needs these overrides for browser dev/build, put test config in its own `vitest.config.ts`
  (Vitest ignores `vite.config.ts`'s `test` block when a sibling `vitest.config.ts` exists) rather than
  sharing one file. `apps/extension-wallet` and `apps/web-dashboard` both do this — copy that pattern
  for any new app that needs browser polyfills.
- **Two entry points in `apps/extension-wallet`** (see "Running apps locally" above) — a polyfill or
  early side-effect import added to one and not the other passes `pnpm build` but fails `pnpm dev` /
  e2e, or vice versa.
- **`git commit` runs lint-staged (prettier + eslint --fix) automatically.** If your diff looks
  different after committing than what you wrote, that's why — re-read the actual committed diff rather
  than assuming your working-tree edit is what shipped.

## Documentation index

[docs/README.md](docs/README.md)
