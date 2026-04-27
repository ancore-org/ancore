# Cryptography Reference

_Last updated: 2026-04-26_

This document maps implemented cryptographic operations to audit-ready controls.

## 1) Approved algorithms and parameters

| Use case | Algorithm | Parameters | Implementation |
|---|---|---|---|
| At-rest encryption (secret keys, account/session payloads) | AES-GCM | 256-bit key, 12-byte IV | `packages/crypto/src/encryption.ts`, `packages/core-sdk/src/storage/secure-storage-manager.ts` |
| Password-based key derivation | PBKDF2-HMAC-SHA256 | 100,000 iterations (max accepted payload: 600,000) | `packages/crypto/src/encryption.ts`, `packages/core-sdk/src/storage/secure-storage-manager.ts` |
| Signing | Ed25519 | Stellar-compatible signatures | `packages/crypto/src/signing.ts` |
| Mnemonic generation/validation | BIP39 | standard wordlist rules | `packages/crypto/src/mnemonic.ts` |
| HD derivation | BIP44 path for Stellar | `m/44'/148'/0'/0/{index}` | `packages/crypto/src/key-derivation.ts` |
| Randomness | WebCrypto CSPRNG | `crypto.getRandomValues` | crypto + storage modules |

## 2) Cryptographic operations inventory

### 2.1 Secret-key encryption flow

1. Validate input secret + password.
2. Generate 16-byte random salt.
3. Generate 12-byte random IV.
4. Derive AES key with PBKDF2 (100k).
5. Encrypt with AES-256-GCM.
6. Return payload `{version, iterations, salt, iv, ciphertext}`.

### 2.2 Secret-key decryption flow

1. Validate payload structure/version.
2. Validate iteration bounds (`100k..600k`).
3. Re-derive key with provided salt/iterations.
4. Decrypt with AES-GCM.
5. Return generic error on failure.

### 2.3 Secure storage manager flow

1. On first unlock, generate `master_salt` (16 bytes).
2. Derive a PBKDF2 base key from password + `master_salt`.
3. Store encrypted verification payload.
4. Encrypt account/session payloads with derived AES-256-GCM keys using per-payload salt+IV.

## 3) Key material and sensitive values

| Value | Classification | Storage | Notes |
|---|---|---|---|
| Private/secret key | Critical | encrypted payload only | Never persisted plaintext in reviewed secure paths |
| Mnemonic | Critical | should be encrypted if persisted | treat equivalent to private key |
| Master salt (`master_salt`) | Sensitive | storage adapter | plaintext salt acceptable; not secret alone |
| Verification payload | Sensitive | encrypted payload | used for password verification |
| Session key material | High | encrypted payload | limited-privilege by design |

## 4) Security requirements mapping

- **AES-256-GCM only**: implemented in reviewed encryption paths.
- **PBKDF2 at 100k iterations**: implemented.
- **CSPRNG via WebCrypto**: implemented.
- **No private key leakage in errors**: decryption errors are generic; continue enforcing no sensitive logs.

## 5) Cryptographic assumptions

- Client runtime provides secure WebCrypto (`crypto.subtle`, `getRandomValues`).
- User password entropy is sufficient for PBKDF2 resistance.
- Dependency supply chain remains trustworthy (lockfile and audit gates required).

## 6) Audit checks to perform

- Verify no alternate cipher modes exist outside approved modules.
- Verify no code path serializes plaintext secrets to logs/storage.
- Verify password policy enforced at all user-entry points.
- Verify migrated payloads preserve or strengthen KDF parameters.

## 7) Known gaps / follow-ups

1. Add central crypto policy linter/check to block non-approved primitives.
2. Add explicit memory zeroization strategy where feasible in JS runtime constraints.
3. Add regression tests for "no sensitive content in thrown error messages".
