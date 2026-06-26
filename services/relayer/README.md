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

| Variable              | Required | Description                                                          |
| --------------------- | -------- | -------------------------------------------------------------------- |
| `PORT`                | No       | HTTP listen port (default: `3000`)                                   |
| `RELAYER_AUTH_SECRET` | No       | Bearer token secret required for protected `/relay` routes (JWT/API) |

> **MVP note:** Authentication and signature verification use stub implementations. Replace `stubAuthService` and `stubSignatureService` in `src/server.ts` before production deployment.

---

## API

All endpoints accept and return `application/json`.

### OpenAPI Specification

The service publishes an OpenAPI 3.1 specification that documents all endpoints, request/response schemas, and authentication requirements.

**Specification file:** `services/relayer/openapi.yaml`

**View the spec:**

```bash
# View raw specification
cat services/relayer/openapi.yaml

# Or use a tool like Redoc locally
npx @redocly/cli preview-docs services/relayer/openapi.yaml
```

### Generated TypeScript Types

The OpenAPI specification can be used to generate TypeScript types for use in external integrations (e.g., wallet teams). This ensures type safety when calling the relayer API.

**Regenerate types:**

```bash
# From repository root
pnpm install -D openapi-typescript
pnpm generate:openapi-types

# Or run the script directly
npx ts-node scripts/generate-openapi-types.ts
```

**Generated file:** `services/relayer/src/api/openapi-types.ts`

The generated types include:

- Request schemas (`RelayExecuteRequest`, `RelayValidateRequest`)
- Response schemas (`RelayExecuteResponse`, `ValidationResult`, `HealthResponse`)
- Error schemas (`RelayError`, `ValidationErrorResponse`)

**Usage in external projects:**

```typescript
import type {
  RelayExecuteRequest,
  RelayExecuteResponse,
  ValidationErrorResponse,
} from '@ancore/relayer/src/api/openapi-types';

// Type-safe request construction
const request: RelayExecuteRequest = {
  sessionKey: 'a'.repeat(64),
  operation: 'relay_execute',
  parameters: {
    /* ... */
  },
  signature: 'b'.repeat(128),
  nonce: 1,
};
```

### Contract Tests

The service includes contract tests that verify the actual API implementation matches the OpenAPI specification. These tests boot the real Express app and assert that routes, status codes, and response schemas align with the documented specification.

**Run contract tests:**

```bash
pnpm --filter @ancore/relayer test -- tests/contract
```

If contract tests fail, it indicates either:

1. The implementation has changed and the spec needs updating
2. The spec has changed and the implementation needs updating

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
  "gasUsed": 0
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

| HTTP status | Code(s)                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| `400`       | `VALIDATION_ERROR` — request body failed schema validation                                            |
| `401`       | `UNAUTHORIZED` — missing or invalid Bearer token                                                      |
| `422`       | `INVALID_SIGNATURE`, `SESSION_KEY_EXPIRED`, `NONCE_REPLAY`, `GAS_LIMIT_EXCEEDED`, `SIMULATION_FAILED` |
| `500`       | `INTERNAL_ERROR` — unexpected server-side error                                                       |

**Client handling guide (TypeScript)**

Use a discriminated switch over `error.code` to map relayer errors to user actions:

```typescript
interface RelayErrorBody {
  success: false;
  error: { code: string; message: string };
}

async function callRelay(request: RelayExecuteRequest): Promise<void> {
  const res = await fetch(`${VITE_RELAYER_URL}/relay/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(request),
  });

  if (res.ok) return;

  const body: RelayErrorBody = await res.json();

  switch (body.error.code) {
    case 'INVALID_SIGNATURE':
      // Re-sign the payload with a fresh keypair or re-fetch the session key.
      throw new Error('Signature verification failed — re-sign and retry.');

    case 'SESSION_KEY_EXPIRED':
      // Prompt the user to re-authenticate and obtain a new session key.
      throw new Error('Session key expired — please re-authenticate.');

    case 'NONCE_REPLAY':
      // Increment and re-fetch the nonce; then retry the operation once.
      throw new Error('Nonce already used — fetch a fresh nonce and retry.');

    case 'GAS_LIMIT_EXCEEDED':
      // Reduce operation complexity or split into smaller transactions.
      throw new Error('Gas limit exceeded — simplify the transaction.');

    case 'SIMULATION_FAILED':
      // The contract rejected the simulated call — check inputs and contract state.
      throw new Error('Transaction simulation failed — check your inputs.');

    case 'UNAUTHORIZED':
      // Re-authenticate and obtain a new Bearer token.
      throw new Error('Not authorised — obtain a valid token and retry.');

    case 'VALIDATION_ERROR':
      // Programming error — fix the request shape at the call site.
      throw new Error(`Invalid request: ${body.error.message}`);

    default:
      throw new Error(`Relayer error (${body.error.code}): ${body.error.message}`);
  }
}
```

> See [docs/integration-guide.md — Relayer error codes](../../docs/integration-guide.md#relayer-error-codes) for the cross-team handling contract.

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

## Example cURL Commands

**Execute a relay transaction:**

```bash
curl -X POST http://localhost:3000/relay/execute \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: unique-request-id" \
  -d '{
    "sessionKey": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "operation": "relay_execute",
    "parameters": {
      "accountAddress": "GBBM6BKZPEBWYY3A3YR4IK7T7XZM5JC5K7NYGR7KDCXYBCJVPQYV5YAA",
      "to": "GD7OEZ2NYNQXK7FLTLQZZCNY2DZV5C7M3F4TNZBAYEBQKVU5RQV6SRQQ",
      "functionName": "transfer",
      "args": ["base64_encoded_xdr"]
    },
    "signature": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "nonce": 1
  }'
```

**Validate a relay transaction:**

```bash
curl -X POST http://localhost:3000/relay/validate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionKey": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "operation": "relay_execute",
    "parameters": {
      "accountAddress": "GBBM6BKZPEBWYY3A3YR4IK7T7XZM5JC5K7NYGR7KDCXYBCJVPQYV5YAA",
      "to": "GD7OEZ2NYNQXK7FLTLQZZCNY2DZV5C7M3F4TNZBAYEBQKVU5RQV6SRQQ",
      "functionName": "transfer",
      "args": ["base64_encoded_xdr"]
    },
    "signature": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "nonce": 1
  }'
```

---

## Project Structure

```
services/relayer/
├── src/
│   ├── types/            # Interface contracts (requests, responses, service contracts)
│   ├── handlers/         # Express route handlers (factories)
│   ├── middleware/        # Auth and validation middleware
│   ├── services/         # Core business logic (RelayService)
│   ├── api/              # Zod schemas and OpenAPI types
│   ├── queue/            # In-memory job queue
│   ├── workers/          # Queue worker
│   └── server.ts         # App factory + entrypoint
├── tests/
│   ├── unit/             # Unit tests (RelayService, middleware)
│   ├── integration/      # Supertest integration tests (all endpoints)
│   └── contract/         # OpenAPI contract tests (validate spec compliance)
├── package.json
├── tsconfig.json
├── openapi.yaml          # OpenAPI 3.1 specification
└── README.md
```
