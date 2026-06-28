# Freighter vs Ancore — Wallet Comparison & Adoption Guide

> **Purpose:** Learn from [Freighter extension](https://github.com/stellar/freighter) and [Freighter Mobile](https://github.com/stellar/freighter-mobile) — SDF’s production Stellar wallets — and document what Ancore should adopt, what it already does well, and what is incorrectly or incompletely implemented today.
>
> **Last reviewed:** 2026-06-16  
> **Freighter extension reference:** v5.42.x (`master`)  
> **Freighter mobile reference:** v1.19.x (`main`)  
> **Ancore reference:** `apps/extension-wallet`, `apps/mobile-wallet`, `packages/core-sdk`

---

## Executive summary

| Dimension | Freighter (prod) | Ancore (today) |
|-----------|------------------|----------------|
| **Account model** | Classic Stellar accounts (G-address) + Soroban | **Smart account (Soroban contract)** + session keys — different product layer |
| **Extension dApp API** | `@stellar/freighter-api` + content script | **Missing** — no content script, no injected API |
| **Signing** | Background-only; real XDR sign + Horizon/RPC submit | **Mostly mock/demo** in send path; partial session-key contract ops |
| **Mobile maturity** | Full RN app, stores, WC v2, Maestro e2e | **Library shell** — vault/history scaffold, no full app store release |
| **Backend** | Freighter backend V1/V2 (balances, sim, discovery) | Ancore relayer + indexer (different architecture) |
| **Security extras** | Blockaid, allowlist, side panel, 24h session | CSP, rate-limited unlock, transfer policy — **no tx scanning, no site allowlist** |

**Strategic note:** Ancore is not a Freighter clone — it adds **account abstraction** (session keys, smart account contract, relayer). Freighter patterns still apply for **wallet UX, security, dApp connectivity, and release engineering**. Adopt Freighter’s *standards*; keep Ancore’s *AA differentiation*.

---

## Table of contents

1. [Architecture comparison](#1-architecture-comparison)
2. [Extension wallet — similarities](#2-extension-wallet--similarities)
3. [Extension wallet — adopt from Freighter](#3-extension-wallet--adopt-from-freighter)
4. [Extension wallet — incorrect / incomplete in Ancore](#4-extension-wallet--incorrect--incomplete-in-ancore)
5. [Mobile wallet — similarities](#5-mobile-wallet--similarities)
6. [Mobile wallet — adopt from Freighter](#6-mobile-wallet--adopt-from-freighter)
7. [Mobile wallet — incorrect / incomplete in Ancore](#7-mobile-wallet--incorrect--incomplete-in-ancore)
8. [Cross-cutting standards to copy](#8-cross-cutting-standards-to-copy)
9. [Priority roadmap (recommended order)](#9-priority-roadmap-recommended-order)
10. [File-level mapping](#10-file-level-mapping)
11. [References](#11-references)

---

## 1. Architecture comparison

### Freighter extension (monorepo)

```
dApp → @stellar/freighter-api (postMessage)
     → contentScript → background (service worker)
     → [approval popup / side panel]
     → sign with keys in background → return signed XDR
```

- **Workspaces:** `extension/`, `@stellar/freighter-api/`, `@shared/*`, `docs/`
- **State:** Redux Toolkit (popup + background session slice)
- **Build:** Webpack, MV3, Firefox + Chrome + Safari converter
- **Keys:** Never in popup; PBKDF2 hash key + AES temporary store in background

### Ancore extension

```
Popup (React) → messaging → background service worker
                          → SecureStorageManager unlock / health probes
Send flow (popup) → demo SendService (mock sign) OR AncoreClient (session keys only)
```

- **Monorepo package:** `apps/extension-wallet`
- **State:** Zustand (settings, session keys, contacts)
- **Build:** Vite, MV3, Chrome-focused
- **Keys:** `@ancore/core-sdk` `SecureStorageManager` + `@ancore/crypto` — **good foundation, not wired to send/sign handlers**

### Freighter mobile (standalone RN app)

- Full app: onboarding → tabs (History / Home / Discovery)
- **WalletConnect v2** for dApps (no browser extension API)
- **Keychain** + Scrypt Key Manager + 24h hash-key session
- **Backend-heavy:** balances, simulation, discovery via Freighter backend

### Ancore mobile

- **Embeddable library** (`apps/mobile-wallet` exports screens/security/hooks)
- Custom `MobileSecureVault` (PBKDF2 + AES-GCM) — parallel to, not shared with, core-sdk vault
- History via **indexer adapter** (good pattern)
- **No** WalletConnect, **no** store release pipeline, **no** real onboarding keygen

---

## 2. Extension wallet — similarities

These are areas where Ancore is already aligned with Freighter-style wallet engineering.

| Area | Freighter | Ancore | Verdict |
|------|-----------|--------|---------|
| MV3 service worker | Yes | Yes (`manifest.json`, `service-worker.ts`) | ✅ Same generation |
| Typed internal messaging | `SERVICE_TYPES` enum | `messaging/types.ts` envelopes | ✅ Same idea |
| Password vault | PBKDF2 + encrypted store | `SecureStorageManager` (PBKDF2 100k + AES-GCM) | ✅ Comparable |
| BIP39 / Stellar derivation | `stellar-hd-wallet` | `@ancore/crypto` BIP44 `m/44'/148'/…` | ✅ Comparable |
| Network enum | PUBLIC / TESTNET / FUTURENET | `mainnet` / `testnet` / `futurenet` in settings | ✅ Aligned |
| Strict CSP | MV3 defaults + build guards | Explicit CSP + `check-csp.js` / vite guard | ✅ Good |
| Auto-lock / inactivity | 24h alarm + session clear | `lock-manager.ts`, `InactivityDetector`, hotkey | ✅ Present (different TTL policy) |
| Unlock rate limiting | Session handling | `unlock-rate-limit.ts` (exponential backoff) | ✅ Ancore adds explicit throttling |
| Soroban awareness | First-class RPC + swap | Session keys, contract ops via `AncoreClient` | ⚠️ Different focus (AA vs classic) |
| E2E tests | Playwright (12+ flows) | Playwright smoke (`tests/e2e/`) | ⚠️ Ancore much thinner |
| i18n | en + pt, scanner in CI | English only | ❌ Gap |

---

## 3. Extension wallet — adopt from Freighter

### 3.1 dApp connectivity (critical — Freighter’s core product)

Freighter ships:

- **`@stellar/freighter-api`** — npm package for sites
- **Content script** at `document_start` — filters `postMessage`, forwards to background
- **External message types** — `requestAccess`, `getAddress`, `signTransaction`, `signAuthEntry`, `addToken`, etc.
- **Per-origin allowlist** — network-scoped domain approval
- **Approval UX** — dedicated sign window or Chrome **side panel**

**Ancore should add:**

| Item | Freighter reference | Ancore target |
|------|---------------------|---------------|
| Published wallet API package | `@stellar/freighter-api` | `@ancore/wallet-api` (new package) |
| Content script | `extension/src/contentScript/` | `apps/extension-wallet/src/content-script/` |
| External + internal message split | `@shared/constants/services.ts` | Extend `messaging/types.ts` with `EXTERNAL_*` |
| Response queue (UUID promises) | `freighterApiMessageListener` | Background queue + approval routes |
| Site allowlist storage | `ALLOWLIST_ID` per network + pubkey | New store keyed by contract account id |
| Sign transaction handler | `handlers/signTransaction.ts` | Background handler using real key + XDR |
| Soroban auth entry signing | `signAuthEntry.ts` | Required for Soroban dApps + session keys |
| Side panel signing UX | `sidePanel` permission | Optional; improves MV3 UX vs popup-only |

**AA-specific extension:** Freighter signs as G-address. Ancore must expose APIs for **smart account address**, **session-key-scoped sign**, and optionally **relayer submit** — document in API spec separately.

### 3.2 Background-centric signing (non-negotiable)

Freighter rule: **popup never holds decrypted private keys**.

Ancore today:

- Unlock works in background (`UNLOCK_WALLET` → `SecureStorageManager`)
- Send path signs in popup via **demo** `SendService`

**Adopt:** All `SIGN_TRANSACTION`, `SIGN_AUTH_ENTRY`, `SIGN_BLOB` handlers in `service-worker.ts` (or dedicated background modules). Popup only displays approval UI and passes user consent messages.

### 3.3 Transaction security pipeline

Freighter before every dApp sign:

1. Parse & validate XDR
2. **Blockaid** malicious transaction scan
3. Mainnet **memo-required** check (Horizon + Stellar Expert directory)
4. User review screen with simulation preview

**Ancore adopt list:**

- Integrate Blockaid (or equivalent) in review step — `Send/ReviewScreen.tsx`, future dApp sign view
- Memo validation on mainnet sends
- Soroban simulation before sign (Freighter uses RPC; Ancore can use relayer or direct Soroban RPC via `@ancore/stellar`)

### 3.4 Redux/session persistence pattern (optional vs Zustand)

Freighter persists **hash key metadata** in `browser.storage.session` via Redux middleware so service worker restarts don’t force password re-entry on every click.

Ancore uses in-memory `_sessionUnlocked` in service worker — **lost on SW sleep**.

**Adopt:** Persist unlock session flag + expiry in `chrome.storage.session` (Ancore already uses session storage for rate-limit state). Align TTL policy (Freighter: 24h; Ancore: configurable auto-lock minutes).

### 3.5 Shared workspace layout

Freighter:

```
@shared/constants, @shared/helpers, @shared/api
@stellar/freighter-api
extension/
```

**Ancore recommendation:**

```
packages/wallet-api/          # dApp-facing API (like freighter-api)
packages/wallet-shared/       # message types, network constants, allowlist helpers
apps/extension-wallet/
```

Avoid duplicating network URLs and message enums inside the extension app only.

### 3.6 Build & release engineering

| Freighter standard | Ancore action |
|--------------------|---------------|
| `yarn build:extension:production` with env validation | Gate `pnpm build` on required `INDEXER_URL`-style env vars |
| Pre-push translation scan | Add i18n key scanner when locales added |
| Three build flavors (dev / experimental / prod) | Add `staging` build profile matching relayer/indexer URLs |
| Playwright with extension fixture + screenshots | Expand `tests/e2e/` beyond smoke; add onboarding, send, allowlist flows |
| LavaMoat allow-scripts | Evaluate supply-chain script policy for extension |
| Cross-browser (Firefox manifest v2/v3) | Track Firefox WebExtensions compatibility |

### 3.7 Documentation & agent standards

Freighter maintains [AGENTS.md](https://github.com/stellar/freighter/blob/master/AGENTS.md), architecture reference docs, and Docusaurus API playgrounds.

**Ancore (done):**

- [AGENTS.md](../../AGENTS.md) — monorepo index
- [apps/extension-wallet/AGENTS.md](../../apps/extension-wallet/AGENTS.md) — extension agent guide
- [apps/mobile-wallet/AGENTS.md](../../apps/mobile-wallet/AGENTS.md) — mobile agent guide

**Still to adopt:**

- Interactive docs for `@ancore/wallet-api` methods (mirror Freighter’s signTransaction playground)

---

## 4. Extension wallet — incorrect / incomplete in Ancore

Priority-ordered issues found in the Ancore codebase vs Freighter production bar.

### P0 — Blocks production wallet

| Issue | Evidence (Ancore) | Freighter pattern | Fix |
|-------|-------------------|-------------------|-----|
| **No dApp bridge** | `manifest.json` has no `content_scripts` | Content script + freighter-api | Add content script + wallet API package |
| **Mock send/sign path** | `useSendTransaction` default demo service; mock `signed:` strings | Real XDR sign in background | Wire `SendService` to background `SIGN_TRANSACTION` |
| **Messaging handlers missing** | Types define `SIGN_TRANSACTION`, `SEND_TRANSACTION`; SW only implements lock/unlock/health | 70+ background handlers | Implement sign/send/balance handlers |
| **Dual onboarding paths** | Router demo (`CreateAccountScreen` sets `hasOnboarded` without keygen) vs real `useOnboarding` not in main router | Single onboarding → Key Manager | Wire `useOnboarding` to `ExtensionRouter`; remove demo auth path |
| **No site connection model** | Any future API would be wide open | Allowlist per network + account | Implement before shipping external API |

### P1 — Security / correctness

| Issue | Evidence | Fix |
|-------|----------|-----|
| Session unlock lost on SW restart | `_sessionUnlocked` in-memory in `service-worker.ts` | Persist session state in `chrome.storage.session` with expiry |
| Auth state split across stores | `ancore_extension_auth` (localStorage) + Zustand + SW flag | Single auth/session source of truth |
| Session key ID format inconsistency | UI generates keys one way; contract expects 64-char hex | Standardize on contract format everywhere |
| No transaction simulation in production send | `SimulationPreview` UI exists; demo backend | Soroban RPC or relayer simulate before confirm |
| No malware/scam tx scanning | — | Blockaid or equivalent |
| E2E uses “Reset demo wallet” | `lock-unlock.spec.ts` | E2E against real vault flow |

### P2 — UX / parity

| Issue | Evidence | Freighter has |
|-------|----------|---------------|
| Inline placeholder Session Keys in router | `router/index.tsx` vs `screens/SessionKeys/` | Dedicated management screens |
| Hardware wallet support | — | Ledger via WebHID |
| Swap / token management | — | Soroswap integration, addToken API |
| Collectibles / NFTs | — | Backend v2 + handlers |
| Side panel signing | — | Chrome sidePanel for MV3 |
| i18n | English only | en + pt, CI translation gate |

### P3 — Engineering hygiene

| Issue | Notes |
|-------|-------|
| Vitest excludes important suites | Onboarding, SessionKeys integration, messaging tests excluded in `vitest.config.ts` — re-enable as they stabilize |
| No `@ancore/wallet-api` npm publish | Freighter’s main distribution channel is the npm API |
| README still describes `TransactionBuilder.build()` as NotImplemented | Update `packages/account-abstraction/README.md` after recent fixes |

---

## 5. Mobile wallet — similarities

| Area | Freighter Mobile | Ancore Mobile | Verdict |
|------|------------------|---------------|---------|
| PBKDF2 password stretching | ScryptEncrypter (Key Manager) | PBKDF2 100k in `MobileSecureVault` | ✅ Same class of solution |
| Biometric unlock | Keychain + `react-native-biometrics` | `useBiometricUnlock` + lockout manager | ✅ Pattern match (web adapter placeholder) |
| Auth state machine | NOT_AUTHENTICATED / LOCKED / AUTHENTICATED | Vault locked/unlocked + lockout phases | ⚠️ Similar intent, less complete |
| History pagination | Backend-driven | `usePaginatedTransactionHistory` + indexer adapter | ✅ Good adapter pattern |
| Payment URI parsing | QR flows | `linking/paymentUri.ts` (SEP-7 style) | ✅ Present |
| Network config | Constants + AsyncStorage | `config/environment.ts` | ✅ Present |
| Zustand ducks | 24 ducks | Not used — context/reducer onboarding | Different style |

---

## 6. Mobile wallet — adopt from Freighter

### 6.1 Full application shell

Freighter Mobile is a **shippable app** (iOS/Android, Fastlane, TestFlight, Play internal).

Ancore mobile is a **library** exported from `apps/mobile-wallet/src/index.ts`.

**Adopt:**

- Host app or expand repo with `ios/` / `android/` (Freighter has flavors `dev` / `prod`)
- Dual bundle IDs (`org.ancore.wallet.dev` / prod) — isolates Keychain like Freighter
- `RELEASE.md` + GitHub Actions release workflow

### 6.2 Key storage tiers

Freighter factory pattern:

| Tier | Storage | Contents |
|------|---------|----------|
| Secure | Keychain | Mnemonic, hash key, temp store, auth status |
| Biometric | Keychain | Password blob for biometric unlock |
| Data | AsyncStorage | Account metadata, prefs, recent addresses |

Ancore today:

- `MobileSecureVault` + `MemorySecureStoreAdapter` (in-memory only in tests)

**Adopt:**

- Replace memory adapter with `react-native-keychain` in production
- Never store seeds in AsyncStorage (Freighter rule — enforce in code review)
- Use `@stellar/typescript-wallet-sdk-km` **or** unify with `@ancore/core-sdk` `SecureStorageManager` — **avoid two vault implementations**

### 6.3 WalletConnect v2 (mobile dApp standard)

Freighter Mobile uses `@reown/walletkit` with Stellar namespace methods:

- `stellar_signXDR`
- `stellar_signAndSubmitXDR`
- `stellar_signMessage` (SEP-53)
- `stellar_signAuthEntry` (SEP-43)

**Ancore:** No WC integration.

**Adopt:** `WalletKitProvider`, session approval sheets, Blockaid on connect + sign, deep link handler (`ancore://wc?uri=...`). For AA, WC methods may need extension for **smart account address** and **session-key metadata**.

### 6.4 Onboarding flows

Freighter Mobile onboarding:

1. Password + confirm
2. Recovery phrase display + **word-grid validation**
3. Optional biometrics
4. Import: scan first 6 HD accounts on mainnet for existing funds

Ancore mobile onboarding:

- Navigation scaffold only (`WalletCreateScreen` = name field, no keygen)

**Adopt:** Full flow wired to `@ancore/core-sdk` `createWallet` / `importWallet` (same as extension `useOnboarding`).

### 6.5 Backend integration pattern

Freighter mobile **does not** call Soroban RPC directly for most flows — it uses backend for simulate, balances, history.

Ancore already has **indexer** + **relayer** — equivalent split but different APIs.

**Adopt Freighter’s client patterns:**

- Central `transactionService` / `transactionBuilder` duck equivalent
- Retry policy on Horizon submit (504 backoff, max 5)
- Health check before send (`isRpcHealthy` equivalent against indexer/relayer)

### 6.6 Security controls

| Freighter Mobile | Ancore adopt |
|------------------|--------------|
| `jail-monkey` root detection | Add root/jailbreak block screen |
| Blockaid tx + site scan | Integrate on WC and in-app send |
| `SecureClipboardService` | Auto-clear clipboard after copy mnemonic/address |
| 24h hash key expiry + `AuthCheckProvider` polling | Match session TTL + foreground/background poll intervals |
| E2E env with dedicated test mnemonics | Document `E2E_*` env vars; never use prod seeds |

### 6.7 Testing & CI

| Freighter Mobile | Ancore adopt |
|------------------|--------------|
| Jest mirrors `src/` in `__tests__/` | Already similar |
| **Maestro** YAML e2e (not Detox) | Add `e2e/flows/` for create/import/send |
| `mock-dapp` for WC manual/automated tests | Add mock WC server for Ancore |
| Pre-commit: lint + **full test suite** | Align husky hooks |

---

## 7. Mobile wallet — incorrect / incomplete in Ancore

### P0 — Blocks production mobile

| Issue | Evidence | Fix |
|-------|----------|-----|
| **Not a shippable app** | Library exports only; no store pipelines | Add host RN app + native projects |
| **In-memory secure store** | `MemorySecureStoreAdapter` | Keychain-backed adapter |
| **Onboarding doesn’t create keys** | `WalletCreateScreen` — name only | Wire to core-sdk wallet APIs |
| **Parallel vault vs core-sdk** | `MobileSecureVault` separate from `SecureStorageManager` | Single vault abstraction across extension + mobile |
| **No WalletConnect** | — | WC v2 for mobile dApps |
| **WebAuthn biometrics placeholder** | `platform-adapters.ts` WebAuthn service | Native biometric adapter for RN |

### P1 — Feature gaps

| Issue | Notes |
|-------|-------|
| No account discovery on import | Freighter scans 6 derived accounts — adopt for UX |
| No soft logout vs full wipe | Freighter distinguishes lock screen vs delete wallet |
| SDK client is read-only | `createMobileWalletSdkClient()` — no sign/send |
| Indexer URL not in `environment.ts` | Passed ad hoc to history adapter — centralize like Freighter env |
| README mentions Expo | Package is library-first — fix docs |

### P2 — Parity nice-to-haves

- In-app Discovery browser + protocol listings (Freighter backend v2)
- Swap flow (Soroswap)
- Collectibles
- Force-update / maintenance remote config gates
- Sentry + Amplitude patterns

---

## 8. Cross-cutting standards to copy

These are **process and code standards** from Freighter that apply to all Ancore wallet work.

### 8.1 Security standards

1. **Private keys only in background (extension) or secure session store (mobile)** — never in React state longer than needed.
2. **Typed message enums** — internal vs external API types; reject unknown messages at content script boundary.
3. **Allowlist before sign** — domain + network + account scoped.
4. **User approval is a separate route** — `/sign-transaction`, not inline modal hidden in home screen.
5. **Handler response contract** — success payload OR `{ error: string }`, never mixed.
6. **Auto-lock** — time-based + explicit lock; clear decrypted material on lock.
7. **Rate-limit unlock attempts** — Ancore already has this; keep aligned with Freighter session clear on exhaustion.
8. **Scan before sign** — Blockaid or equivalent for dApp and WC flows.
9. **Minimal manifest permissions** — Freighter: `storage`, `alarms`, `sidePanel` only; Ancore: audit before adding `tabs`, `scripting`, etc.

### 8.2 Code organization standards

1. **Ducks / domain stores** — one module per domain (`auth`, `transactionBuilder`, `settings`); Freighter mobile enforces layer direction (components → hooks → ducks → services).
2. **Routes as enums** — no magic path strings (`routes.ts`).
3. **Shared constants package** — network definitions, service type enums, Soroban RPC URLs in one place.
4. **Services layer for IO** — Horizon, backend, storage factories; UI does not fetch directly.
5. **Absolute imports** — Freighter mobile uses `src/` aliases; Ancore extension uses `@/` — keep consistent per app.

### 8.3 Testing standards

1. **Colocated `__tests__`** next to source (both projects already do this — **not** at repo root).
2. **Playwright (extension)** with unpacked extension fixture, extension ID extraction, API stubs.
3. **Maestro (mobile)** for onboarding/send/WC flows; dedicated test recovery phrases in env.
4. **Visual regression** — Freighter uses Playwright screenshots; consider for extension popup UI.
5. **Do not skip security tests in CI** — re-enable Ancore vitest exclusions incrementally.

### 8.4 i18n standards

- All user strings via `t()` / i18next
- CI fails if new strings missing from locale files
- Start with `en`; add `pt` when targeting LatAm (Freighter already does)

### 8.5 Release standards

- Sync version across `package.json`, native projects (5 files in Freighter mobile)
- Dev + prod bundle IDs side by side on device
- Fastlane → TestFlight / Play internal
- Emergency release branch procedure documented (`RELEASE.md`)

### 8.6 Observability

- Sentry in background handlers and mobile app shell
- Opt-in analytics (Amplitude) with clear privacy policy
- Structured logs without sensitive fields (Ancore relayer already documents redaction — extend to wallets)

---

## 9. Priority roadmap (recommended order)

### Phase 1 — Extension wallet “real money” path (8–12 weeks)

1. Unify onboarding — remove demo router path; single vault-backed flow
2. Background signing handlers (`SIGN_TRANSACTION`, balance, account info)
3. Wire `useSendTransaction` to real sign + Horizon/RPC submit via `@ancore/stellar`
4. Session persistence across service worker restarts
5. Soroban simulate before confirm on send review screen

### Phase 2 — dApp connectivity (6–10 weeks)

1. `@ancore/wallet-api` npm package
2. Content script + external message types
3. Allowlist + grant-access approval UI
4. `signAuthEntry` for Soroban dApps
5. Side panel signing (Chrome)

### Phase 3 — Security parity (4–6 weeks)

1. Blockaid (or alternative) integration
2. Mainnet memo checks
3. Expand Playwright e2e (onboarding, send, lock, allowlist)

### Phase 4 — Mobile productionization (12–16 weeks)

1. Unify vault with core-sdk
2. Keychain storage adapter
3. Full onboarding + import + account discovery
4. WalletConnect v2 + mock-dapp
5. Maestro e2e + Fastlane release pipeline
6. Jailbreak detection

### Phase 5 — AA differentiation (ongoing — Ancore advantage)

These are **not** in Freighter; keep investing here:

- Session key lifecycle UI tied to contract permissions
- Relayer meta-transactions and gas abstraction
- Smart account deployment flow on onboarding
- Indexer-driven account activity for **contract events** (not just classic ops)
- Web dashboard + extension unified account model

---

## 10. File-level mapping

### Extension: Freighter → Ancore

| Freighter module | Ancore equivalent | Status |
|------------------|-------------------|--------|
| `extension/src/background/index.ts` | `apps/extension-wallet/src/background/service-worker.ts` | Partial |
| `messageListener/handlers/signTransaction.ts` | — | **Missing** |
| `contentScript/redirectMessagesToBackground.ts` | — | **Missing** |
| `@stellar/freighter-api` | — | **Missing** |
| `@shared/constants/stellar.ts` | `packages/types` + `stores/settings.ts` | Partial |
| `popup/views/SignTransaction` | `screens/Send/ReviewScreen.tsx` | Partial (in-app only) |
| `helpers/session.ts` (PBKDF2/AES) | `packages/core-sdk/.../secure-storage-manager.ts` | Good |
| `ducks/settings` (network) | `stores/settings.ts`, `state/dashboard-settings.ts` | Split — consolidate |
| `e2e-tests/*` | `apps/extension-wallet/tests/e2e/*` | Thin |

### Mobile: Freighter → Ancore

| Freighter module | Ancore equivalent | Status |
|------------------|-------------------|--------|
| `src/ducks/auth.ts` | `navigation/onboarding.tsx` + vault | Scaffold only |
| `src/ducks/transactionBuilder.ts` | — | **Missing** |
| `src/services/storage/storageFactory.ts` | `storage/mobile-secure-storage-adapter.ts` | Memory only |
| `src/providers/WalletKitProvider.tsx` | — | **Missing** |
| `src/screens/history/*` | `screens/history/*` | Good adapter pattern |
| `src/config/constants.ts` (networks) | `config/environment.ts` | Good |
| `e2e/flows/*` (Maestro) | — | **Missing** |
| `fastlane/*` | — | **Missing** |

---

## 11. References

### Freighter (production — learn from these)

- Extension: https://github.com/stellar/freighter
- Mobile: https://github.com/stellar/freighter-mobile
- API docs: https://docs.freighter.app
- Backend V1: https://github.com/stellar/freighter-backend
- Backend V2: https://github.com/stellar/freighter-backend-v2
- Developer docs: https://github.com/stellar/freighter-developer-docs

### Ancore (implement here)

- [AGENTS.md](../../AGENTS.md) — monorepo agent index
- Extension: `apps/extension-wallet/` — [AGENTS.md](../../apps/extension-wallet/AGENTS.md)
- Mobile: `apps/mobile-wallet/` — [AGENTS.md](../../apps/mobile-wallet/AGENTS.md)
- SDK vault: `packages/core-sdk/src/storage/secure-storage-manager.ts`
- Crypto: `packages/crypto/`
- Account abstraction: `packages/account-abstraction/`, `contracts/account/`
- Relayer: `services/relayer/`
- Indexer: `services/indexer/`

### Related Ancore docs

- [Extension build troubleshooting](../troubleshooting/extension-build.md)
- [Extension wallet security](../security/extension-wallet.md)
- [System architecture](../architecture/OVERVIEW.md)

---

## Appendix A — What NOT to copy from Freighter

Ancore should **not** abandon its differentiators to become a Freighter fork:

| Freighter assumption | Ancore difference |
|--------------------|-------------------|
| Classic G-address account | Soroban **smart account contract** |
| Sign with account private key directly | Owner key + **session keys** with contract permissions |
| Horizon-first payment flows | **Relayer** + contract `execute` path |
| Same backend as SDF Freighter | **Ancore indexer/relayer** APIs — different URLs, schemas |
| `@stellar/freighter-api` wire format | May need **AA-extended API** (session capabilities, contract id) |

Use Freighter for **wallet engineering discipline**; use Ancore contracts/SDK for **product logic**.

---

## Appendix B — Quick checklist for PR reviews

Use this when reviewing wallet PRs:

- [ ] No private key material in popup/mobile JS heap beyond immediate sign call
- [ ] No new secrets in localStorage (extension) or AsyncStorage (mobile)
- [ ] External/dApp messages validated at content script boundary
- [ ] User saw dedicated approval screen before sign
- [ ] Network matches transaction network before sign
- [ ] Simulation or fee estimate shown before confirm
- [ ] Errors mapped to user-readable messages (`errors/` module)
- [ ] Unit tests colocated in `__tests__/`
- [ ] E2e updated if flow is user-critical
- [ ] CSP/connect-src updated if new endpoints added
- [ ] i18n keys added (when locale system exists)

---

*Maintainers: update this doc when Freighter ships major version changes or when Ancore closes gaps above. Re-diff Freighter `master` / `main` at least once per release cycle.*
