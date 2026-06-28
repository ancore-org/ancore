# Ancore Extension Wallet

> Non-custodial Stellar **account abstraction** wallet browser extension (MV3).
> Monorepo package: popup UI, background service worker, Zustand stores.
> Production benchmark: [Freighter AGENTS.md](https://github.com/stellar/freighter/blob/master/AGENTS.md).

## Glossary

| Term               | Meaning                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------ |
| **Popup**          | Extension UI — React app at `src/popup/`, runs in the action popup (~360px)                |
| **Background**     | Service worker at `src/background/` — vault unlock, health probes, message handlers        |
| **Content Script** | _Planned_ — dApp bridge via `window.postMessage` (not implemented yet; see comparison doc) |
| **Smart account**  | Soroban contract account (C-address) — not a classic G-address                             |
| **Session key**    | Time-limited signing key registered on the smart account contract                          |
| **XDR**            | Stellar binary serialization format for transactions and ledger entries                    |
| **Soroban**        | Stellar smart contract platform; Ancore account contract lives here                        |
| **Relayer**        | Ancore service that submits meta-transactions / contract executes                          |
| **Indexer**        | Ancore REST service for account activity and history                                       |
| **Horizon**        | Stellar REST API for classic ledger queries and submission                                 |
| **Mnemonic**       | BIP-39 seed phrase; derived via `@ancore/crypto` (`m/44'/148'/…`)                          |
| **Zustand store**  | Feature-scoped client state (`stores/account.ts`, `settings.ts`, etc.)                     |

## Documentation

- [Freighter vs Ancore comparison](../../docs/wallets/FREIGHTER_COMPARISON.md) — adoption roadmap
- [Extension security](../../docs/security/extension-wallet.md)
- [Extension build troubleshooting](../../docs/troubleshooting/extension-build.md)
- [E2E smoke guide](../../docs/testing/extension-e2e-smoke.md)
- [Contributing (monorepo)](../../CONTRIBUTING.md)
- [System architecture](../../docs/architecture/OVERVIEW.md)
- Freighter reference: [AGENTS.md](https://github.com/stellar/freighter/blob/master/AGENTS.md), [API docs](https://docs.freighter.app)

## Quick Reference

| Item              | Value                                                      |
| ----------------- | ---------------------------------------------------------- |
| Package           | `@ancore/extension-wallet`                                 |
| Language          | TypeScript, React 18                                       |
| Node              | >= 20 (monorepo); use `corepack pnpm` on Windows if needed |
| Package Manager   | pnpm 9 (workspace)                                         |
| State Management  | Zustand 5                                                  |
| Build             | Vite 5                                                     |
| Testing           | Vitest (unit), Playwright (e2e smoke)                      |
| Linting           | ESLint 9 flat config                                       |
| Default Branch    | `main`                                                     |
| Branch Convention | `type/description` (`feature/`, `fix/`, `chore/`)          |

## Build & Test Commands

From repo root:

```bash
corepack pnpm --filter @ancore/extension-wallet dev          # Vite dev server (popup HMR)
corepack pnpm --filter @ancore/extension-wallet build        # Production dist/
corepack pnpm --filter @ancore/extension-wallet test         # Vitest unit tests
corepack pnpm --filter @ancore/extension-wallet lint         # ESLint
corepack pnpm --filter @ancore/extension-wallet check:csp    # CSP validation script
corepack pnpm --filter @ancore/extension-wallet test:e2e:smoke   # Playwright @smoke
corepack pnpm --filter @ancore/extension-wallet test:e2e     # Full Playwright suite
```

From `apps/extension-wallet/`:

```bash
corepack pnpm dev
corepack pnpm build
corepack pnpm test
```

Load unpacked: `chrome://extensions` → Load unpacked → `apps/extension-wallet/dist/`

## Environment & Service URLs

Service URLs resolve from settings storage with defaults in `src/config/urls.ts`:

| Service | Default (prod)              | Purpose                |
| ------- | --------------------------- | ---------------------- |
| Relayer | `https://relayer.ancore.io` | Transaction submission |
| Indexer | `https://indexer.ancore.io` | Activity / history     |

CSP `connect-src` in `manifest.json` must include any new endpoints. Run `pnpm check:csp` after changes.

## Repository Structure

```
apps/extension-wallet/
├── manifest.json              # MV3 manifest (permissions, CSP)
├── src/
│   ├── popup/                 # React entry (main.tsx)
│   ├── background/            # Service worker + unlock rate limit
│   ├── messaging/             # Typed popup ↔ background messages
│   ├── screens/               # Onboarding, Send, SessionKeys, Settings, …
│   ├── stores/                # Zustand (account, settings, session, contacts)
│   ├── hooks/                 # useLockManager, useSendTransaction, …
│   ├── security/              # Lock manager, inactivity, storage manager wiring
│   ├── router/                # ExtensionRouter, AuthGuard
│   ├── config/                # Service URLs, health probes
│   ├── errors/                # Error boundary, classification
│   └── components/            # Shared UI
├── tests/
│   ├── e2e/                   # Playwright specs (@smoke tagged)
│   └── fixtures/              # Extension load helpers
├── store/                     # Chrome Web Store listing assets
└── scripts/                   # check-csp.js, analyze-bundle.js
```

**Planned (Freighter parity):**

```
packages/wallet-api/           # @ancore/wallet-api — dApp npm SDK ✅ scaffold
packages/wallet-shared/      # protocol + network constants ✅ scaffold
src/content-script/          # postMessage bridge ✅ stub
```

## Architecture

Two runtime contexts today (three when content script ships):

```
Popup (React)  ──chrome.runtime.sendMessage──►  Background (service worker)
                                                      │
                                                      ├─ SecureStorageManager (@ancore/core-sdk)
                                                      ├─ UNLOCK_WALLET / LOCK_WALLET
                                                      └─ CHECK_SERVICE_HEALTH
```

1. **Popup** — UI only. Sends typed messages via `messaging/sender.ts`. Must **not** hold decrypted private keys.
2. **Background** — Registers handlers via `messaging/handler.ts`. Only context that should touch vault material after unlock.

**Account abstraction path:** Session keys and contract ops go through `@ancore/account-abstraction` (`AncoreClient`) and `@ancore/stellar`. Smart account deployment and execute flows differ from Freighter’s classic G-address signing.

**Current gaps vs Freighter:** No content script, no `@ancore/wallet-api`, `SIGN_TRANSACTION` / `SEND_TRANSACTION` types exist but background handlers are not fully wired; send flow still uses demo `SendService` in `hooks/useSendTransaction.ts`. See [FREIGHTER_COMPARISON.md](../../docs/wallets/FREIGHTER_COMPARISON.md).

## Security-Sensitive Areas

Do not modify without understanding security impact:

| Area                  | Path                                   | Notes                                       |
| --------------------- | -------------------------------------- | ------------------------------------------- |
| Background / signing  | `src/background/`                      | Vault unlock, future sign handlers          |
| Messaging             | `src/messaging/`                       | Typed enums only — no raw string types      |
| Secure storage wiring | `src/security/storage-manager.ts`      | Delegates to `@ancore/core-sdk`             |
| Manifest & CSP        | `manifest.json`                        | Minimal permissions (`storage` only today)  |
| Unlock rate limit     | `src/background/unlock-rate-limit.ts`  | Exponential backoff on failed unlock        |
| Crypto / keys         | `packages/core-sdk`, `packages/crypto` | Shared with other apps — coordinate changes |

**Rules (from Freighter, adapted for Ancore):**

- Private keys and mnemonics only in background after explicit unlock.
- Never persist decrypted key material in `localStorage` or Zustand persisted slices.
- External/dApp messages (when added) must be validated at the content script boundary.
- User approval for signing must use a dedicated route/screen, not a hidden inline action.
- Handler responses: success payload **or** `{ error: string }` — never mixed shapes.

## Known Complexity / Gotchas

- **Dual onboarding paths:** Demo router flow (`router/index.tsx`) vs real vault flow (`screens/Onboarding/`, `hooks/useOnboarding.ts`). Prefer the vault path; do not extend the demo path.
- **Service worker sleep:** `_sessionUnlocked` is in-memory — lost when MV3 SW terminates. Persist session expiry in `chrome.storage.session` (Freighter pattern).
- **Vitest exclusions:** Onboarding, SessionKeys integration, and messaging tests are excluded in `vitest.config.ts` — re-enable as they stabilize; do not add new exclusions without reason.
- **Windows pnpm:** Use `corepack pnpm` if bare `pnpm` is not on PATH (see CONTRIBUTING.md).
- **pretest hook:** Unit tests build `@ancore/ui-kit` first — allow extra time on cold CI.
- **Send mock:** Default `createDemoSendService()` returns fake `signed:` strings — replace with background signing before any mainnet use.
- **Session key ID format:** Contract expects 64-char hex public keys — keep UI, SDK, and contract aligned.
- **Build reload:** Background changes require extension reload in `chrome://extensions`; popup HMR works in dev.

## Pre-submission Checklist

```bash
corepack pnpm --filter @ancore/extension-wallet lint
corepack pnpm --filter @ancore/extension-wallet test
corepack pnpm --filter @ancore/extension-wallet build
corepack pnpm --filter @ancore/extension-wallet check:csp
# If user-facing flows changed:
corepack pnpm --filter @ancore/extension-wallet test:e2e:smoke
```

Manual checks for security-sensitive PRs:

- [ ] No private key in popup React state beyond immediate UI needs
- [ ] New network endpoints reflected in CSP and `config/urls.ts`
- [ ] Message types added to `messaging/types.ts` with handler in background
- [ ] Colocated tests in `__tests__/` next to source
- [ ] E2E updated if onboarding, lock, send, or session-keys flow changed

## Best Practices Entry Points

| Concern                         | Entry Point                                                                                                                   | When to Read                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Freighter parity & gaps         | [docs/wallets/FREIGHTER_COMPARISON.md](../../docs/wallets/FREIGHTER_COMPARISON.md)                                            | Any wallet feature, dApp API, signing |
| Extension security              | [docs/security/extension-wallet.md](../../docs/security/extension-wallet.md)                                                  | Keys, storage, CSP                    |
| Messaging                       | `src/messaging/types.ts`, `handler.ts`                                                                                        | New popup ↔ background APIs           |
| Account abstraction             | `packages/account-abstraction/`                                                                                               | Session keys, contract execute        |
| Core vault                      | `packages/core-sdk/src/storage/secure-storage-manager.ts`                                                                     | Password, encrypt/decrypt             |
| E2E                             | `tests/e2e/`, [docs/testing/extension-e2e-smoke.md](../../docs/testing/extension-e2e-smoke.md)                                | Playwright changes                    |
| Freighter messaging (reference) | [Freighter messaging skill](https://github.com/stellar/freighter/tree/master/docs/skills/freighter-best-practices/references) | Designing content script + API        |

## Related Packages

| Package                       | Role                                           |
| ----------------------------- | ---------------------------------------------- |
| `@ancore/core-sdk`            | Vault, wallet create/import                    |
| `@ancore/crypto`              | BIP39, HD derivation, signing primitives       |
| `@ancore/stellar`             | Horizon / Soroban RPC helpers                  |
| `@ancore/account-abstraction` | Smart account client, session keys, tx builder |
| `@ancore/types`               | Shared wallet/network types                    |
| `@ancore/ui-kit`              | Shared React components                        |

## Internationalization (i18n)

The extension uses [react-i18next](https://react.i18next.com/) with a single English locale today.

| Path                            | Purpose                                                      |
| ------------------------------- | ------------------------------------------------------------ |
| `src/i18n/index.ts`             | Initializes i18next with the `en` namespace                  |
| `src/i18n/en.json`              | English strings, grouped by screen (e.g. `settings`, `send`) |
| `src/i18n/settings-labels.ts`   | Helpers for enum-backed labels (network, theme, auto-lock)   |
| `scripts/lint-translations.mjs` | CI/local guard for missing keys                              |

Initialization runs from `src/popup/main.tsx` (production popup entry) and `src/main.tsx` (local dev).

### Conventions

1. **Screen namespaces** — Top-level keys match screens or flows: `settings.title`, `send.amountLabel`, `onboarding.welcome`.
2. **Use `t('namespace.key')`** — Prefer static string keys in JSX. Avoid hardcoded user-visible English in components.
3. **Interpolation** — Use i18next placeholders for dynamic copy: `t('settings.network.currentlyOn', { network })`.
4. **Enum labels** — Put switch-based helpers next to the locale file (see `settings-labels.ts`) so every key stays explicit and discoverable.
5. **Sub-screens** — When migrating a flow, add keys under that screen namespace before replacing literals. `SettingsScreen` is the reference implementation.

### Adding strings

1. Add the key to `src/i18n/en.json` under the correct screen namespace.
2. Replace the JSX literal with `const { t } = useTranslation()` and `t('screen.key')`.
3. Run `pnpm lint:translations` from `apps/extension-wallet` (or the repo root via `pnpm --filter @ancore/extension-wallet lint:translations`).

### Translation lint

```bash
pnpm lint:translations
```

The script scans `src/**/*.ts(x)` for static `t('...')` calls and fails if any key is missing from `en.json`. It also blocks new hardcoded user-visible literals in **i18n-enforced files**:

- `src/screens/Settings/SettingsScreen.tsx`
- `src/i18n/settings-labels.ts`

Add a file to `I18N_ENFORCED_FILES` in `scripts/lint-translations.mjs` once it is fully migrated. CI runs this in the **Extension Translation Lint** job on every PR.

### Visual regression

The smoke e2e suite includes a settings-screen check (`tests/e2e/smoke.spec.ts`) that asserts i18n strings render in the browser. A Playwright screenshot baseline lives at `tests/e2e/smoke.spec.ts-snapshots/settings-header-chromium-darwin.png` for local layout checks (`maxDiffPixelRatio: 0.02`). Screenshot comparison is skipped in CI because platform font rendering differs; CI relies on the text assertions instead.

### Out of scope (for now)

- Portuguese (`pt.json`) and multi-locale completeness checks
- RTL layout
- Advanced pluralization beyond basic `{{count}}` interpolation

When LatAm localization starts, add `src/i18n/pt.json` and extend the lint script to require parity with `en.json`.
