# @ancore/relayer

Transaction relay service for the Ancore account abstraction layer. Accepts signed relay requests from clients and submits them to Soroban smart contracts on behalf of session-key holders.

---

## Deployment Requirements

| Requirement     | Value                            |
| --------------- | -------------------------------- |
| Node.js         | >= 20.0.0                        |
| Package manager | pnpm >= 9.0.0                    |
| Port            | `PORT` env var (default: `3000`) |

### Environment Variables

| Variable | Required | Description                        |
| -------- | -------- | ---------------------------------- |
| `PORT`   | No       | HTTP listen port (default: `3000`) |

> **MVP note:** Authentication and signature verification use stub implementations. Replace `stubAuthService` and `stubSignatureService` in `src/server.ts` before production deployment.

---

## API

All endpoints accept and return `application/json`.

### `POST /relay/execute`

Execute a signed relay transaction.

**Auth:** `Authorization: Bearer <token>` required.

**Request body:**

```json
{
  "sessionKey": "<64-char hex Ed25519 public key>",
  "operation": "relay_execute | add_session_key | revoke_session_key",
  "parameters": {},
  "signature": "<128-char hex Ed25519 signature>",
  "nonce": 1
}
```

**Response `200`:**

```json
{
  "success": true,
  "transactionId": "<64-char hex>",
  "gasUsed": 21000
}
```

**Response `422` (invalid signature / nonce):**

```json
{
  "success": false,
  "error": { "code": "INVALID_SIGNATURE", "message": "..." },
  "gasUsed": 0
}
```

---

### `POST /relay/validate`

Validate a relay request without executing it. Useful for pre-flight checks.

**Auth:** `Authorization: Bearer <token>` required.

Same request body as `/relay/execute`.

**Response `200`:** `{ "valid": true }`

**Response `422`:** `{ "valid": false, "error": { "code": "...", "message": "..." } }`

---

### `GET /relay/status`

Health check. No authentication required.

**Response `200`:**

```json
{
  "status": "ok",
  "uptime": 42,
  "timestamp": "2026-04-24T14:00:00.000Z"
}
```

---

## Error Codes

| Code                  | Meaning                                                        |
| --------------------- | -------------------------------------------------------------- |
| `INVALID_SIGNATURE`   | Ed25519 signature verification failed or malformed session key |
| `SESSION_KEY_EXPIRED` | Session key has passed its expiration timestamp                |
| `NONCE_REPLAY`        | Nonce is negative or has already been used                     |
| `GAS_LIMIT_EXCEEDED`  | Simulated gas exceeds the enforced limit                       |
| `SIMULATION_FAILED`   | Transaction simulation rejected by the contract                |
| `UNAUTHORIZED`        | Missing or invalid Bearer token                                |
| `INTERNAL_ERROR`      | Unexpected server-side error                                   |

**HTTP status mapping:**

- `400` — schema validation failure (`VALIDATION_ERROR`)
- `401` — authentication failure (`UNAUTHORIZED`)
- `422` — business-logic rejection (all other codes above)

---

## Security Model

### Session Key Validation

Every request carries a 64-char hex-encoded Ed25519 public key (`sessionKey`) and a 128-char hex-encoded signature (`signature`) over the canonical payload:

```
JSON.stringify({ sessionKey, operation, nonce })  →  hex-encode  →  verify
```

The `SignatureServiceContract` interface abstracts the cryptographic primitive. The MVP stub always returns `true`; replace with `@noble/ed25519` or equivalent before production.

### Nonce Replay Protection

The service rejects negative nonces at the validation layer. Full replay tracking (persisting used nonces per session key) is out of scope for the MVP skeleton and must be added before production.

### Rate Limiting

Not implemented in the MVP skeleton. Add an Express rate-limit middleware (e.g. `express-rate-limit`) in `src/server.ts` before exposing the service publicly.

### Gas Limit Enforcement

The mock implementation returns a fixed `gasUsed` of `21 000`. Real enforcement requires simulation against a Soroban RPC node before submission.

### Transport Security

Deploy behind TLS termination (e.g. AWS ALB, nginx). The service itself does not handle TLS.

### Threat Summary

| Threat              | Mitigation                                          |
| ------------------- | --------------------------------------------------- |
| Signature forgery   | Ed25519 verification (stub → real before prod)      |
| Replay attacks      | Nonce validation (full tracking needed before prod) |
| Abuse / DoS         | Rate limiting (not yet implemented)                 |
| Gas griefing        | Gas limit enforcement (not yet implemented)         |
| Unauthorised access | Bearer token auth on all mutating endpoints         |

---

## Development

```bash
# Install dependencies (from repo root)
pnpm install

# Build
pnpm --filter @ancore/relayer build

# Run tests
pnpm --filter @ancore/relayer test

# Start (development)
pnpm --filter @ancore/relayer start
```

---

## Integration Guidelines

Dependent services should:

1. Obtain a Bearer token from the auth service and pass it in every request.
2. Generate a fresh Ed25519 keypair per session and register the public key on the account contract before calling `/relay/execute`.
3. Increment the nonce monotonically per session key to prevent replay.
4. Call `/relay/validate` before `/relay/execute` to surface errors cheaply.
5. Treat `transactionId` as an opaque identifier; poll the indexer service for confirmation.

---

## Project Structure

```
services/relayer/
├── src/
│   ├── types/            # Interface contracts (requests, responses, service contracts)
│   ├── handlers/         # Express route handlers (factories)
│   ├── middleware/        # Auth and validation middleware
│   ├── services/         # Core business logic (RelayService)
│   ├── api/              # Zod schemas for existing API surface
│   ├── queue/            # In-memory job queue
│   ├── workers/          # Queue worker
│   └── server.ts         # App factory + entrypoint
├── tests/
│   ├── unit/             # Unit tests (RelayService, middleware)
│   └── integration/      # Supertest integration tests (all endpoints)
├── package.json
├── tsconfig.json
└── README.md
```
