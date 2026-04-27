# Security Audit Checklist (Pre-Mainnet)

_Last updated: 2026-04-26_

This checklist is the working artifact for internal pre-audit review of the extension wallet and shared SDK/contract stack.

## Scope

- Browser extension wallet (`apps/extension-wallet`)
- Core SDK/storage (`packages/core-sdk`)
- Crypto primitives (`packages/crypto`)
- Account contract (`contracts/account`)
- Relayer API auth middleware (`services/relayer`)

## How to use this checklist

- `✅ Done`: evidence exists and has been verified in code/tests/docs.
- `⚠️ Partial`: partly implemented or implemented with gaps.
- `❌ Open`: not implemented or not yet validated.

---

## 1) Cryptography

### Required controls

- [x] ✅ All encryption uses AES-256-GCM.
- [x] ✅ Key derivation uses PBKDF2 with 100k iterations.
- [x] ✅ Random generation uses `crypto.getRandomValues`.
- [x] ✅ No private keys in logs/errors.
- [x] ✅ Decryption failure messages are generic.
- [x] ✅ Encrypted payloads are versioned and validated.

### Evidence

- AES-GCM + 256-bit key usage in `encryptSecretKey` and `decryptSecretKey`. (`packages/crypto/src/encryption.ts`)
- PBKDF2 iteration floor/ceiling (`100000`/`600000`) enforced in payload validation. (`packages/crypto/src/encryption.ts`)
- `getRandomValues` used for salt/IV generation in crypto and secure storage manager. (`packages/crypto/src/encryption.ts`, `packages/core-sdk/src/storage/secure-storage-manager.ts`)

---

## 2) Sensitive data storage

### Required controls

- [x] ✅ Private keys always encrypted at rest (SDK secure storage path).
- [x] ✅ Sensitive account/session data encrypted before persistence in secure storage manager.
- [x] ✅ Storage quota errors are typed and handled.
- [ ] ❌ Data cleared on uninstall.
- [ ] ❌ No security-sensitive state in plaintext localStorage (currently partial).

### Sensitive storage inventory

| Location | Data | Protection | Status |
|---|---|---|---|
| `chrome.storage.local` / `browser.storage.local`: `account`, `sessionKeys` | account/session key payloads | AES-256-GCM encrypted payload | ✅ |
| `chrome.storage.local` / `browser.storage.local`: `master_salt`, `verification_payload` | KDF salt + encrypted verifier | verifier encrypted; salt plaintext by design | ✅ |
| `localStorage`: `ancore_extension_auth` | auth/session flags + wallet metadata | plaintext JSON | ⚠️ |
| `localStorage`: telemetry/error buffers | operational logs/events | plaintext JSON | ⚠️ |

### Notes

- Plaintext storage currently appears limited to metadata/session flags, not private keys.
- Uninstall data cleanup strategy is not implemented in extension lifecycle handlers.

---

## 3) Authentication & session management

### Required controls

- [x] ✅ Password complexity rules exist in crypto package.
- [x] ✅ Auto-lock timer exists (`LockManager` + `InactivityDetector`).
- [x] ✅ Session timeout is configurable (settings-driven auto-lock).
- [ ] ❌ Failed unlock attempt limiting/backoff.
- [ ] ❌ Production-grade password verification in extension service worker flow.

### Authentication flow review

1. User unlock request reaches background `UNLOCK_WALLET` message handler.
2. Handler checks onboarding state and password shape.
3. Session unlock flag persisted and mirrored in memory.
4. Router guards enforce lock/unlock navigation state.

**Known gap:** service worker currently contains TODO to replace placeholder password check with `SecureStorageManager.unlock(password)` verification.

---

## 4) Network and API security

### Required controls

- [ ] ⚠️ HTTPS-only endpoint enforcement in code/config.
- [ ] ⚠️ Explicit certificate pinning/validation strategy.
- [x] ✅ No sensitive data in URLs in reviewed auth middleware (Bearer header used).
- [ ] ❌ Rate limiting policy documented and enforced for relayer endpoints.

### Evidence

- Relayer authentication expects bearer token in `Authorization` header and returns 401 on missing/invalid token. (`services/relayer/src/middleware/auth.ts`)

---

## 5) Permissions usage (extension)

### Declared permissions

- [x] ✅ `storage`
- [x] ✅ `activeTab`

### Review

- [x] ✅ `storage` is required for wallet persistence and session/auth metadata.
- [ ] ⚠️ `activeTab` usage should be explicitly justified in security design docs and least-privilege review (code usage should be audited before external review).

---

## 6) External dependencies (security-relevant)

### Crypto and signing

- `@noble/ed25519`
- `@noble/hashes`
- `@stellar/stellar-sdk`
- `bip39`
- `ed25519-hd-key`

### Extension/runtime

- `webextension-polyfill`
- `react`, `react-router-dom`, `zustand`

### Relayer/backend

- `express`
- `zod`

### Contract

- `soroban-sdk`
- `ed25519-dalek` (dev-dependency)
- `rand` (dev-dependency)

---

## 7) Security testing scenarios

- [x] ✅ Crypto round-trip (encrypt/decrypt) tests.
- [x] ✅ Signature verification tests.
- [x] ✅ Session key lifecycle tests (add/revoke/expiry/permissions).
- [x] ✅ Storage unlock/auto-lock behavior tests.
- [ ] ❌ Dedicated abuse-case tests for failed password retry lockout.
- [ ] ❌ Dedicated tests proving no sensitive fields leak into logs.
- [ ] ❌ Network abuse/rate-limit tests for relayer.

---

## 8) Common vulnerability review (internal)

| Vulnerability class | Result | Notes |
|---|---|---|
| Hardcoded secrets/private keys | ✅ No direct evidence in reviewed files | Continue full-repo scan before audit |
| Sensitive logging | ⚠️ Partial | Need explicit test assertions/no-log policy checks |
| Broken authentication | ⚠️ Partial | Extension unlock placeholder logic must be fixed |
| Insecure storage | ⚠️ Partial | Secret material encrypted, but auth metadata is plaintext |
| Missing access control | ✅ Partial coverage | Contract and relayer paths include explicit checks |
| Injection (API) | ⚠️ Unknown | Relayer validation coverage should be expanded |
| Replay/session abuse | ✅ Session/nonces present in contract test snapshots | Confirm full end-to-end paths |

---

## 9) Known issues and mitigation plan

1. **Background unlock placeholder logic**
   - Risk: weak authentication bypass in extension flow.
   - Mitigation: integrate `SecureStorageManager.unlock(password)` and add failed-attempt throttling/lockout.

2. **Plaintext localStorage auth metadata**
   - Risk: local compromise exposes usage/session metadata.
   - Mitigation: migrate sensitive auth/session state to hardened encrypted store or minimize persisted fields.

3. **No uninstall cleanup hook**
   - Risk: data remnants remain after extension removal in some environments.
   - Mitigation: document platform limitations + add explicit reset path and uninstall guidance.

4. **Rate limiting not documented/enforced (relayer)**
   - Risk: brute force and DoS risk.
   - Mitigation: implement IP/token-based rate limiting and add tests.

---

## 10) Pre-audit exit criteria

- [ ] All ❌ checklist items resolved or accepted with compensating controls.
- [ ] Threat model signed off by Engineering + Security.
- [ ] Crypto documentation validated against implementation.
- [ ] Incident response plan approved and exercised (tabletop).
- [ ] Dependency audit and test evidence package generated.

## Internal review sign-off

- Security owner: _TBD_
- Engineering owner: _TBD_
- Internal review date: _Pending_
- External audit ready: **No (open critical items above)**
