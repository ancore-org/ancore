# Ancore Wallet Extension — Target Architecture

> **Status:** Target architecture for contributors. Gaps and roadmap: [FREIGHTER_COMPARISON.md](../wallets/FREIGHTER_COMPARISON.md).
>
> **Production benchmark:** [Freighter extension architecture](https://github.com/stellar/freighter/blob/master/AGENTS.md) — three runtime contexts, background-only signing, typed messaging.

## Design principles

1. **Preserve Ancore AA** — smart account contract id (C-address) is the primary wallet identity; session keys and relayer paths stay first-class. Do not regress to Freighter’s G-address-only model.
2. **Freighter security bar** — keys only in background, allowlist before external sign, dedicated approval routes, typed messages only.
3. **Monorepo packages** — shared protocol in `@ancore/wallet-shared`, dApp SDK in `@ancore/wallet-api`, extension app consumes both.

## Runtime contexts (target)

```
┌─────────────┐   postMessage    ┌──────────────────┐   runtime.sendMessage   ┌─────────────────────┐
│  dApp page  │ ───────────────► │  Content script  │ ───────────────────────►│  Background (SW)    │
│ wallet-api  │ ◄─────────────── │  (document_start)│ ◄───────────────────────│  keys, sign, storage│
└─────────────┘                  └──────────────────┘                         └──────────┬──────────┘
                                                                                         │
┌─────────────┐   runtime.sendMessage                                                      │
│ Popup React │ ◄────────────────────────────────────────────────────────────────────────┘
│ approval UI │   (internal Messages enum — unlock, health, future sign preview)
└─────────────┘
```

| Context | May hold private keys? | Responsibilities |
| ------- | ---------------------- | ---------------- |
| Content script | **Never** | Validate `ANCORE_WALLET_REQUEST`, filter origin, forward to background |
| Background | **Only while unlocked** | Vault, sign XDR, allowlist, external + internal handlers |
| Popup | **Never** | UX, approval screens, dispatch internal messages |

Freighter reference: `extension/src/contentScript/`, `extension/src/background/`, `extension/src/popup/`.

## Package layout

```
packages/
├── wallet-shared/     # Protocol enums, network URLs, allowlist keys, session TTL constants  ✅ scaffold
├── wallet-api/        # npm SDK for dApps (requestAccess, signTransaction, …)               ✅ scaffold
├── core-sdk/          # SecureStorageManager, createWallet, importWallet
├── account-abstraction/  # AncoreClient, session keys, contract execute
└── …

apps/extension-wallet/
├── src/content-script/       ✅ stub forwards to background
├── src/background/
│   ├── handlers/             ✅ internal handlers split by domain
│   ├── session-state.ts      ✅ chrome.storage.session unlock TTL
│   └── service-worker.ts     entry — registers handlers + external stub
├── src/messaging/            internal popup ↔ background typed API
└── src/screens/              approval routes (sign, grant-access — TODO)
```

## Message layers

### Internal messages (`src/messaging/types.ts`)

Popup ↔ background only. Examples: `UNLOCK_WALLET`, `GET_WALLET_STATE`, `CHECK_SERVICE_HEALTH`.

Future: `SIGN_TRANSACTION` handler in `background/handlers/sign-transaction.ts` (not popup).

### External messages (`@ancore/wallet-shared`)

dApp ↔ content script ↔ background. Methods: `requestAccess`, `getAddress`, `getSmartAccount`, `signTransaction`, `signAuthEntry`, `signMessage`.

Implement in `background/handlers/external/` — see [FREIGHTER_COMPARISON §3.1](../wallets/FREIGHTER_COMPARISON.md#31-dapp-connectivity-critical--freighters-core-product).

## Signing flows

### In-app send (popup-initiated)

```
SendScreen → sendMessage('SIGN_TRANSACTION') → background signs with owner or session key
           → optional relayer submit → Horizon/RPC confirmation
```

Freighter equivalent: popup triggers background `signTransaction` handler — never signs in React.

**Today:** demo `SendService` in popup — see [FREIGHTER_COMPARISON §4 P0](../wallets/FREIGHTER_COMPARISON.md#4-extension-wallet--incorrect--incomplete-in-ancore).

### dApp-initiated sign

```
dApp → wallet-api.signTransaction → content script → background → open approval route
     → user confirms → sign → response queue resolves promise
```

Freighter: response queue with UUID — `@stellar/freighter-api` + `freighterApiMessageListener`.

**Allowlist required before sign** — keyed by `(network, smartAccountId, origin)` via `allowlistStorageKey()` in wallet-shared.

## Session persistence

MV3 service workers terminate frequently. Unlock state must survive restarts:

- `chrome.storage.session` record: `{ unlockedAt, expiresAt }` — **implemented** in `session-state.ts`
- Align TTL with user auto-lock setting — see roadmap Phase 1 in [FREIGHTER_COMPARISON](../wallets/FREIGHTER_COMPARISON.md#9-priority-roadmap-recommended-order)

Freighter: Redux middleware persists hash key to session storage.

## Onboarding (AA-specific)

Freighter: mnemonic → G-address.

Ancore:

1. Mnemonic + password → encrypt vault (`@ancore/core-sdk`)
2. Derive owner G-key (`@ancore/crypto`)
3. Deploy / link **smart account contract** (`DeployScreen`, relayer)
4. Persist `smartAccountId` + encrypted mnemonic

**Today:** demo router path skips steps 1–4 — see [FREIGHTER_COMPARISON §4 P0](../wallets/FREIGHTER_COMPARISON.md#4-extension-wallet--incorrect--incomplete-in-ancore).

## Approval UX routes (to add)

| Route | Purpose | Freighter equivalent |
| ----- | ------- | -------------------- |
| `/grant-access` | Allowlist dApp origin | Grant access modal |
| `/sign-transaction` | Review + Blockaid + sign | SignTransaction view |
| `/sign-auth-entry` | Soroban auth entry | signAuthEntry view |

Use dedicated routes — not inline modals on `/home`.

## CSP and permissions

Keep manifest minimal. Adding content scripts does **not** require new permissions.

Before adding `tabs`, `scripting`, or broad `host_permissions`, document why in a security review.

Run `pnpm check:csp` after changing `connect-src`.

## Contributor entry points

| Task | Start here |
| ---- | ---------- |
| dApp API | [FREIGHTER_COMPARISON §3.1](../wallets/FREIGHTER_COMPARISON.md#31-dapp-connectivity-critical--freighters-core-product) |
| Real onboarding | [FREIGHTER_COMPARISON §4 P0](../wallets/FREIGHTER_COMPARISON.md#4-extension-wallet--incorrect--incomplete-in-ancore) |
| Background signing | [WALLET_EXTENSION.md](./WALLET_EXTENSION.md) |
| Agent rules | [apps/extension-wallet/AGENTS.md](../../apps/extension-wallet/AGENTS.md) |
| Freighter comparison | [docs/wallets/FREIGHTER_COMPARISON.md](../wallets/FREIGHTER_COMPARISON.md) |

## What we intentionally do not copy from Freighter

| Freighter | Ancore keeps |
| --------- | ------------ |
| G-address as primary identity | Smart account contract id |
| Direct account key sign only | Session keys + contract `execute` |
| Freighter backend V1/V2 | Ancore relayer + indexer |
| Identical freighter-api wire format | AA-extended methods (`getSmartAccount`, relayer submit flag) |

