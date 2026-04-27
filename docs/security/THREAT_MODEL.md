# Threat Model (Extension + SDK + Contract)

_Last updated: 2026-04-26_

Method: STRIDE-style analysis over key trust boundaries and critical assets.

## 1) System context

Primary components:
- Extension wallet UI/background runtime
- Core SDK secure storage + crypto primitives
- Soroban account contract and session-key authorization logic
- Relayer API endpoints and bearer-token middleware
- Stellar RPC/Horizon and third-party infra dependencies

## 2) Assets

| Asset | Criticality | Why |
|---|---|---|
| User private keys / mnemonics | Critical | direct fund control |
| Session keys | High | delegated, time-bound signing authority |
| Contract nonce/session state | High | replay and authorization safety |
| Wallet auth/session state | Medium | unauthorized local wallet access risk |
| Telemetry/error logs | Medium | may leak metadata if mishandled |

## 3) Trust boundaries

1. **User device/browser boundary**
   - Threats: malware, local compromise, extension context abuse.
2. **Extension ↔ chain/API network boundary**
   - Threats: MITM, endpoint spoofing, metadata leakage.
3. **Client ↔ relayer boundary**
   - Threats: token theft/replay, brute force, DoS.
4. **Contract execution boundary**
   - Threats: logic bugs, authorization bypass, replay.

## 4) Threat scenarios and mitigations

| ID | Threat | Impact | Existing controls | Residual risk |
|---|---|---|---|---|
| T1 | Local theft of storage data | account takeover | encrypted account/session payloads via AES-GCM + PBKDF2 | metadata still plaintext in some localStorage keys |
| T2 | Weak/placeholder unlock logic in extension flow | unauthorized wallet unlock | lock state + onboarding guard | **high until secure password verification path replaces placeholder** |
| T3 | Brute force against unlock or relayer auth | account/session abuse | bearer-token auth middleware, generic 401 responses | missing explicit lockout/rate-limit implementation |
| T4 | Replay of signed operations | unauthorized repeats | contract nonce/session expiry behavior and tests | verify full stack enforcement before audit |
| T5 | Session key permission escalation | unauthorized operations | session key permission + expiry checks in contract tests | medium if integration mismatches exist |
| T6 | Dependency compromise | broad compromise | lockfile, audit scripts, override pins | requires continuous audit discipline |
| T7 | Sensitive logs/error leakage | data exposure | generic decryption failures | no explicit "no-secret-log" test gate yet |

## 5) Abuse cases to test

1. Unlock attempts with invalid password repeated N times.
2. Manipulated local auth metadata while wallet remains locked in secure manager.
3. Expired/revoked session key attempts across contract and SDK caller path.
4. Relayer token replay from a different client origin/IP.
5. Malformed encrypted payloads (salt/iv/version/iterations corruption).
6. Attempted plaintext secret insertion into extension storage keys.

## 6) High-priority mitigations (before external audit)

1. Replace background unlock placeholder logic with real `SecureStorageManager.unlock(password)` verification.
2. Implement failed-attempt throttling/lockout for unlock and relayer auth paths.
3. Enforce HTTPS-only endpoint configuration and document allowed hosts.
4. Add explicit test coverage for sensitive logging and local metadata tampering.
5. Document/implement uninstall/reset data lifecycle behavior.

## 7) Risk acceptance policy (pre-audit)

- No Critical residual risks accepted without compensating control + leadership sign-off.
- High risks require dated remediation plan and owner.
- Medium risks must be tracked in audit findings backlog.

## 8) Owners and review cadence

- Security owner: _TBD_
- Engineering owner: _TBD_
- Review cadence: on each release-candidate cut and after major auth/crypto changes.
