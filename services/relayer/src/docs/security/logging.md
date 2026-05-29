# Relayer Service — Logging Security Policy

This document defines the log redaction rules for the Relayer service and explains
how sensitive values are handled before they reach any log sink.

---

## Why Redaction Matters

The Relayer processes Ed25519 session keys and signatures on behalf of users.
If these values appear in plain text in log files, they could be extracted by
anyone with access to the log sink (CloudWatch, Datadog, Loki, etc.) and used
to impersonate a session or replay a signed transaction.

---

## Sensitive Value Categories

| Category | Examples | Redaction rule |
|---|---|---|
| **Ed25519 public key** | `sessionKey` (64-char hex) | First 8 chars + `…[REDACTED]` |
| **Ed25519 signature** | `signature` (128-char hex) | First 8 chars + `…[REDACTED]` |
| **Signed payload / XDR** | `signedTransactionXdr`, canonical payload hex | Fully replaced with `[REDACTED]` |
| **Bearer token / secret** | `Authorization` header value, `token`, `privateKey`, `secret` | Fully replaced with `[REDACTED]` |

The partial preview (first 8 chars) for keys and signatures is intentional:
it allows log correlation across entries for the same key without exposing
enough material to reconstruct the full value.

---

## Redaction Helpers

All helpers live in `src/logging/redact.ts` and are re-exported from `src/logging/index.ts`.

```typescript
import {
  redactPublicKey,    // Ed25519 public key / session key
  redactSignature,    // Ed25519 signature
  redactSignedPayload,// XDR blobs, canonical payload hex
  redactSecret,       // Bearer tokens, API keys, private keys
  redactRelayRequest, // Convenience: redacts a full relay request body
} from '../logging';
```

### Usage at log call sites

```typescript
// ✅ Correct — sensitive fields are wrapped
logger.info(
  { from: redactPublicKey(from), to: redactPublicKey(to) },
  'relay_execute'
);

// ✅ Correct — use the convenience helper for full request bodies
logger.info(redactRelayRequest(req.body), 'relay_execute_received');

// ❌ Forbidden — raw key in log object
logger.info({ sessionKey }, 'relay_execute');

// ❌ Forbidden — raw signature in log object
logger.warn({ signature }, 'invalid_signature');
```

---

## Existing Policy Enforcement

### 1. Unit tests (`src/logging/__tests__/redact.test.ts`)

The test suite verifies:
- Each helper produces the expected redacted output.
- The full sensitive value does NOT appear anywhere in the output.
- `redactRelayRequest` redacts all sensitive fields in a realistic request body.
- Security assertions explicitly check that raw keys, signatures, and XDR blobs
  are absent from the serialised log output.

### 2. CI grep script (`scripts/check-log-redaction.js`)

A Node.js script scans all TypeScript source files in `src/` for log call sites
that pass raw sensitive field names without a redaction wrapper. The script:

- Exits with code `0` if no violations are found.
- Exits with code `1` and prints the offending file, line number, and rule if
  any violation is detected.
- Is integrated into the CI pipeline as a dedicated step in the `relayer-security`
  job (see `.github/workflows/ci.yml`).

Run locally:

```bash
node services/relayer/scripts/check-log-redaction.js
```

---

## What Is Safe to Log

The following fields are **not** sensitive and may appear in logs without redaction:

- `operation` — the relay operation name (`relay_execute`, `add_session_key`, etc.)
- `nonce` — the request nonce (an integer)
- `transactionId` — the Stellar transaction hash returned after submission
- `gasUsed` — the gas consumed by the transaction
- `errorCode` / `errorMessage` — structured error codes and messages
- HTTP metadata: `method`, `path`, `statusCode`, `contentLength`, `latencyMs`
- Infrastructure metadata: `requestId`, `callerId`, `timestamp`

---

## Adding New Log Sites

When adding a new log call that involves request data:

1. Check whether any field is in the sensitive categories table above.
2. If yes, wrap it with the appropriate helper from `src/logging/redact.ts`.
3. Run `node services/relayer/scripts/check-log-redaction.js` locally to verify.
4. Add a test case to `src/logging/__tests__/redact.test.ts` if you introduce
   a new sensitive field or a new redaction helper.

---

## Related Issues

- [#660](https://github.com/ancore-org/ancore/issues/660) — Initial implementation of this policy
- [#651](https://github.com/ancore-org/ancore/issues/651) — Structured logging foundation (complemented by this issue)
