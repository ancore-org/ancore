# Ancore Roadmap

> **Last updated:** June 2026  
> Status key: ✅ Done · 🔄 In progress · 🔲 Planned · ❌ Blocked

---

## Phase 1 — Extension "real money" path
**Goal:** A user can create a wallet, send real XLM/USDC on testnet, and see confirmation.  
**Estimate:** 8–12 weeks  
**Exit criteria:** Playwright e2e `send.spec.ts` passes against a real vault and testnet relayer.

| # | Item | Issue | Status |
|---|------|-------|--------|
| 1.1 | Real BIP39 + HD key onboarding | #815 | 🔲 |
| 1.2 | Mnemonic word-grid verification | #816 | 🔲 |
| 1.3 | Smart account contract deploy on onboarding | #817 | 🔲 |
| 1.4 | Remove demo auth router path | #818 | 🔲 |
| 1.5 | Wallet import (mnemonic recovery) | #819 | 🔲 |
| 1.6 | Real send: vault decrypt + sign + relayer submit | #820 | 🔲 |
| 1.7 | Soroban simulate before confirm | #821 | 🔲 |
| 1.8 | Fee estimation on review screen | — | 🔲 |
| 1.9 | Transaction confirmation polling | #822 | 🔲 |
| 1.10 | Relayer: real Ed25519 signature verify | #854 | 🔲 |
| 1.11 | Relayer: Postgres nonce replay table | #853 | 🔲 |
| 1.12 | Relayer: real Soroban simulate | #852 | 🔲 |

---

## Phase 2 — dApp connectivity
**Goal:** A dApp using `@ancore/wallet-api` can connect to Ancore, request access, and sign transactions.  
**Estimate:** 6–10 weeks  
**Exit criteria:** A test dApp can call `connect()`, `signTransaction()`, and `signAuthEntry()` against the extension.

| # | Item | Issue | Status |
|---|------|-------|--------|
| 2.1 | Content script dApp bridge with origin filter | #808 | 🔲 |
| 2.2 | GET_PUBLIC_KEY + GET_NETWORK background handlers | #809 | 🔲 |
| 2.3 | /grant-access approval route | #810 | 🔲 |
| 2.4 | Per-origin site allowlist store | #811 | 🔲 |
| 2.5 | Response-queue UUID pattern in background | #812 | 🔲 |
| 2.6 | wallet-api getAddress, getNetwork, isConnected | #813 | 🔲 |
| 2.7 | wallet-api signTransaction method | #828 | 🔲 |
| 2.8 | wallet-api signAuthEntry (SEP-43) | #829 | 🔲 |
| 2.9 | wallet-api content script bridge implementation | #827 | 🔲 |
| 2.10 | SIGN_TRANSACTION background handler | #763 | 🔲 |
| 2.11 | signAuthEntry background handler (SEP-43) | #770 | 🔲 |
| 2.12 | Publish @ancore/wallet-api to npm | #779 | 🔲 |
| 2.13 | Chrome side panel signing UX | #814 | 🔲 |
| 2.14 | Session key request API for dApps | #873 | 🔲 |

---

## Phase 3 — Security parity
**Goal:** Ancore meets Freighter's security bar for mainnet use.  
**Estimate:** 4–6 weeks  
**Exit criteria:** `pnpm audit` clean, Blockaid integrated, internal contract audit report published.

| # | Item | Issue | Status |
|---|------|-------|--------|
| 3.1 | Internal contract security audit | #863 | 🔲 |
| 3.2 | Contract fuzz tests | #833 | 🔲 |
| 3.3 | Blockaid scan for dApp sign | #876 | 🔲 |
| 3.4 | Blockaid scan for in-app send | #771 | 🔲 |
| 3.5 | Memo-required check for mainnet sends | #823 | 🔲 |
| 3.6 | Session security hardening (SW restart, TTL) | #769 | 🔲 |
| 3.7 | Connected sites management screen | #871 | 🔲 |
| 3.8 | Expanded Playwright e2e suite | #826 | 🔲 |
| 3.9 | Relayer per-account rate limiting | #874 | 🔲 |
| 3.10 | Relay payload test vectors | #860 | 🔲 |

---

## Phase 4 — Mobile productionization
**Goal:** iOS and Android apps in TestFlight/Play internal, WalletConnect working.  
**Estimate:** 12–16 weeks  
**Exit criteria:** Maestro e2e passes for create/import/send and WalletConnect pairing on both platforms.

| # | Item | Issue | Status |
|---|------|-------|--------|
| 4.1 | Unify MobileSecureVault with core-sdk | #782 | 🔲 |
| 4.2 | react-native-keychain production adapter | #846 | 🔲 |
| 4.3 | Mobile onboarding: real BIP39 keygen | #844 | 🔲 |
| 4.4 | Mobile onboarding: mnemonic verification | #845 | 🔲 |
| 4.5 | Mobile import: HD account discovery | #845 | 🔲 |
| 4.6 | Biometric native adapter (react-native-biometrics) | #847 | 🔲 |
| 4.7 | WalletKit initialization | #839 | 🔲 |
| 4.8 | stellar_signXDR WalletConnect handler | #840 | 🔲 |
| 4.9 | stellar_signAuthEntry WalletConnect handler | #841 | 🔲 |
| 4.10 | Session approval sheet UI | #842 | 🔲 |
| 4.11 | Deep link handler (ancore://wc) | #843 | 🔲 |
| 4.12 | iOS native project + Fastlane TestFlight | #848 | 🔲 |
| 4.13 | Android native project + Fastlane Play | #849 | 🔲 |
| 4.14 | Maestro e2e flows (basic + WalletConnect) | #786, #850 | 🔲 |
| 4.15 | Mobile transaction builder + relayer submit | #851 | 🔲 |
| 4.16 | HD account discovery scan on wallet import | #788 | 🔲 |

---

## Phase 5 — AA differentiation (ongoing)
**Goal:** Ship the features only Ancore can offer — session keys as first-class product, passkey onboarding, AI payments.  
**Estimate:** Ongoing alongside Phases 3–4  
**Exit criteria:** One flagship dApp uses Ancore session keys in production; passkey onboarding ships in testnet.

| # | Item | Issue | Status |
|---|------|-------|--------|
| 5.1 | Contract: allowed_contracts in session key policy | #831 | 🔲 |
| 5.2 | Contract: spend limits and time window | #832 | 🔲 |
| 5.3 | Contract: ValidationModule hook interface | #835 | 🔲 |
| 5.4 | PasskeyModule: WebAuthn P-256 session key | #859 | 🔲 |
| 5.5 | WebAuthn onboarding design RFC | #869 | 🔲 |
| 5.6 | Session Keys UI wired to contract | #773 | 🔲 |
| 5.7 | Core SDK: deployAndInitializeAccount helper | #861 | 🔲 |
| 5.8 | Core SDK: Ledger hardware wallet adapter | #872 | 🔲 |
| 5.9 | AI agent: Claude Haiku NL→intent parsing | #836 | 🔲 |
| 5.10 | AI agent: risk score field | #837 | 🔲 |
| 5.11 | Indexer: Soroban contract event decoder | #856 | 🔲 |
| 5.12 | Indexer: session_key_events table + REST API | #857 | 🔲 |
| 5.13 | Indexer: contract address filter in activity | #858 | 🔲 |
| 5.14 | Relayer: OpenTelemetry trace spans | #855 | 🔲 |
| 5.15 | Relayer: Prometheus metrics + Grafana dashboard | #875 | 🔲 |

---

## Not in scope (post-PMF)

- Mainnet launch (gated on external contract audit)
- Social recovery guardian flow
- Invoice contract (request-to-pay)
- Cross-chain bridges
- zk-proof validation modules
- Decentralized relayer network
- Swap / DEX integration

---

## Milestone targets

| Milestone | Target | Gate |
|-----------|--------|------|
| Phase 1 complete | Q3 2026 | Testnet send e2e passing |
| Phase 2 complete | Q4 2026 | dApp API functional, wallet-api published |
| Phase 3 complete | Q4 2026 | Internal audit report, Blockaid live |
| Phase 4 alpha | Q1 2027 | TestFlight build available |
| Mainnet beta | Q2 2027 | External audit complete |
