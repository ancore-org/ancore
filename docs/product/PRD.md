# Ancore Product Requirements Document (PRD)

> **Version:** 0.1 (MVP)  
> **Last updated:** June 2026  
> **Status:** Draft — pending core team review

---

## 1. Product Vision

Ancore is the smart account wallet for Stellar. It gives developers and users the infrastructure to build financial applications without the UX friction of traditional key management — no per-transaction popups, no seed phrases required for daily use, and gasless transactions via sponsored relayer.

**One-line pitch:**  
*"Connect once. Your dApp runs. No popups."*

---

## 2. Problem

### For end users
- Every Stellar transaction requires a wallet popup approval (Freighter pattern)
- Seed phrases are a security and UX liability — users lose funds when they lose them
- Gas fees create friction for onboarding new users (must fund account before first use)

### For dApp developers
- Per-transaction signing UX kills engagement in games, DeFi automation, and subscription flows
- Freighter API is the only option — no alternative with session key support
- No standardized way to sponsor gas for users

---

## 3. Users

| Persona | Description | Primary job-to-be-done |
|---------|-------------|------------------------|
| **Alex** — dApp developer | Builds Soroban DeFi protocol, frustrated by per-tx UX | Integrate Ancore session keys so users sign once per session |
| **Sam** — DeFi power user | Actively manages positions, wants frictionless trading | Approve a session key, trade without popups |
| **Jordan** — Crypto newcomer | First Stellar wallet, intimidated by seed phrases | Create wallet with passkey (future), receive XLM from a friend |

---

## 4. MVP Scope

### In scope (v0.1)

**Extension wallet:**
- Create wallet (BIP39 mnemonic → HD key → AES-GCM vault → smart account deploy)
- Import wallet (mnemonic recovery + HD account discovery)
- Lock / unlock with PBKDF2 + AES-GCM
- Send XLM and USDC on testnet (real vault sign → relayer → Horizon)
- Connect to dApp (REQUEST_ACCESS → per-origin allowlist → approval screen)
- Sign transaction (SIGN_TRANSACTION → approval route → real XDR sign → return)
- Sign auth entry for Soroban dApps (SIGN_AUTH_ENTRY → approval → SEP-43 compliant)
- Session keys: add, list, revoke via extension UI
- Settings: network, auto-lock TTL, connected sites

**@ancore/wallet-api npm package:**
- `connect()`, `getAddress()`, `getNetwork()`, `isConnected()`
- `signTransaction(xdr, opts)` 
- `signAuthEntry(entryXdr, opts)`
- Typed errors: `AncoreUserRejectedError`, `AncoreTimeoutError`, `AncoreNotConnectedError`

**Relayer (testnet):**
- Real Ed25519 signature verification against on-chain session key
- Real Soroban RPC simulation before submit
- Postgres nonce replay protection
- Per-account rate limiting

**Smart account contract:**
- `initialize`, `execute`, `add_session_key`, `revoke_session_key`, `upgrade`
- Session key policy: `allowed_contracts` (allowlist), basic permission bits
- Internal security audit completed before any testnet user funds

### Explicitly out of scope for v0.1

| Feature | Reason |
|---------|--------|
| Mobile app store release | Blocked on WalletConnect completion |
| AI agent LLM integration | Needs product workflow definition |
| WebAuthn / Passkey onboarding | Complex crypto bridge — v0.3 |
| Social recovery | Post-PMF |
| Mainnet launch | Blocked on external contract audit |
| Ledger hardware wallet | Nice to have, not blocking |
| Invoice / request-to-pay | Post-PMF |
| Web dashboard | No user demand signal |
| Multi-language (pt-BR) | After English UX is stable |

---

## 5. User Stories (MVP)

### Create wallet
> **As** a new user, **I want** to create a Stellar wallet without writing down a seed phrase on day 1, **so that** I can start using Ancore immediately.

Acceptance criteria:
- Onboarding generates BIP39 mnemonic and displays all words before proceeding
- Word-grid verification (3 random words) required before vault write
- Smart account contract deployed and C-address stored
- Account funded via friendbot on testnet

### Send payment
> **As** a user, **I want** to send XLM or USDC to another address, **so that** the transaction appears on-chain within 30 seconds.

Acceptance criteria:
- Soroban simulation shown before confirm (actual fee, not estimate)
- Transaction signed by session key in background (vault decrypted in SW, not popup)
- Relayer submits to Horizon; confirmation polled and displayed
- Explorer link shown on success

### Connect dApp
> **As** a dApp developer, **I want** to call `@ancore/wallet-api` `connect()`, **so that** my app receives the user's smart account address.

Acceptance criteria:
- `connect()` triggers grant-access approval window
- Approval window shows dApp origin (favicon + domain), requested permissions
- On approve: origin added to allowlist; `connect()` resolves with C-address
- On reject: `connect()` throws `AncoreUserRejectedError`
- On subsequent calls: `isConnected()` returns `true` without another approval prompt

### Sign transaction (dApp)
> **As** a dApp, **I want** to call `signTransaction(xdr)`, **so that** my users can authorize contract calls without navigating away from my app.

Acceptance criteria:
- Approval window opens with decoded operation summary
- Blockaid risk scan result shown (warning banner or block for malicious)
- On approve: signed XDR returned to dApp within 60s
- On reject: `AncoreUserRejectedError` thrown

### Session key (dApp)
> **As** a DeFi dApp, **I want** to request a session key, **so that** my users don't get a wallet popup for every trade.

Acceptance criteria:
- `requestSessionKey({ expiresAt, allowedContracts, maxAmountPerCall })` triggers session key approval screen
- Approval screen shows: duration, allowed contracts, spend limit in human-readable format
- On approve: session key public key returned; key added to smart account contract
- dApp signs relay payloads with session key; relayer submits without further user interaction

---

## 6. Success Metrics

| Metric | MVP target | Measurement |
|--------|-----------|-------------|
| Testnet active wallets (weekly) | 100 | Indexer: unique C-addresses with activity in 7d |
| dApp integrations (testnet) | 1 flagship | Manual tracking |
| Time-to-first-sign (dApp) | < 3 seconds | Relayer: validate+simulate+submit latency p50 |
| Onboarding completion rate | > 70% | Funnel: step 1 start → C-address stored |
| Extension crash rate | < 1% of sessions | Sentry: sessions with errors / total sessions |
| Relay success rate | > 98% | Prometheus: relay_requests_total{status='success'} |

---

## 7. Technical Dependencies and Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Contract bug in `execute()` causes fund loss | Medium | Internal audit (#863) before testnet user funds; no mainnet until external audit |
| MV3 service worker lifecycle drops response-queue | High | Persist queue to `chrome.storage.session` (#812) |
| Relayer stub auth allows replay attacks | Critical | Replace before any real user traffic (#853, #854) |
| WebAuthn P-256 → Ed25519 bridge complexity | Medium | Design RFC first (#869); implement in Phase 5 |
| dApp API incompatibility with Freighter ecosystem | Medium | Match `@stellar/freighter-api` method signatures where possible |

---

## 8. Release Criteria

See `docs/release/checklist.md` for the full gate. MVP-specific additions:

- [ ] Internal contract security audit report published in `docs/security/INTERNAL_AUDIT_v0.md`
- [ ] At least one dApp integration demo working on testnet
- [ ] Playwright e2e: onboarding, send, grant-access, sign-transaction all passing
- [ ] Relayer: real signature verify + nonce replay protection live
- [ ] Zero `FIXME` / `TODO` / `HACK` comments in MVP code paths (onboarding, send, sign, dApp API)

---

## 9. Open Questions

1. Should the MVP relayer be self-hosted by users, or should Ancore run a shared testnet relayer?
2. What is the session key default TTL for dApps — 24h (Freighter session) or configurable?
3. Should the extension expose the owner G-address or only the C-address to dApps? (Affects Freighter API compatibility)
4. WebAuthn: target browser extension first (navigator.credentials available) or mobile (FaceID) first?
