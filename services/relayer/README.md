# @ancore/relayer

Transaction relay service for the Ancore account abstraction layer. Accepts signed relay requests from clients and submits them to Soroban smart contracts on behalf of session-key holders.

---

## Quickstart

Two ways to get a relayer answering on localhost. Full stack setup — Postgres, indexer, health
checks, teardown, troubleshooting — lives in
**[docs/development/local-services.md](../../docs/development/local-services.md)**.

### Option A — Docker Compose (relayer + indexer + Postgres)

Use this when you need the whole stack, e.g. to see relayed transactions appear in the indexer.

```bash
# From the repository root
docker compose -f docker-compose.dev.yml up

# Verify (compose maps the relayer to host port 3001)
curl http://localhost:3001/relay/status
```

Teardown: `docker compose -f docker-compose.dev.yml down` (add `-v` to drop the Postgres volume).
See [Local Services Setup → Quick Start](../../docs/development/local-services.md#quick-start).

### Option B — pnpm only (relayer alone)

Fastest loop when you are working on the relayer itself.

```bash
# From the repository root
pnpm install
pnpm --filter @ancore/relayer build

# Dev-only: skip real Stellar submission, no RPC node needed. See "Mock mode" below.
RELAYER_USE_MOCK_SUBMISSION=true pnpm --filter @ancore/relayer start

# Verify (defaults to host port 3000)
curl http://localhost:3000/relay/status
```

> **Port note:** the service listens on `PORT` (default `3000`) in both cases. Compose remaps it to
> **3001** on the host so it does not collide with the indexer, which also uses `3000`. Point apps at
> `http://localhost:3001` when using Compose and `http://localhost:3000` when running it directly.

Wiring the wallets and dashboard to a local relayer:
[Local Services Setup → Integration with Applications](../../docs/development/local-services.md#integration-with-applications).

---

## Deployment Requirements

| Requirement     | Value                            |
| --------------- | -------------------------------- |
| Node.js         | >= 20.0.0                        |
| Package manager | pnpm >= 9.0.0                    |
| Port            | `PORT` env var (default: `3000`) |

### Environment Variables

Every variable is optional — the service boots with the defaults below. Defaults are tuned for local
development, so read the **Prod** column before deploying.

**Server and auth**

| Variable              | Default | Prod         | Description                                                                                                                                       |
| --------------------- | ------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                | `3000`  | as needed    | HTTP listen port                                                                                                                                  |
| `RELAYER_AUTH_SECRET` | _unset_ | **required** | Bearer token secret for protected `/relay` routes. **When unset the service falls back to a stub auth service that accepts any non-empty token.** |
| `ALLOWED_ORIGINS`     | `*`     | **set it**   | Comma-separated CORS allowlist, e.g. `http://localhost:5173,https://app.example.com`                                                              |

**Stellar network**

| Variable                     | Default                               | Description                                                                                   |
| ---------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------- |
| `STELLAR_NETWORK`            | `testnet`                             | One of `testnet`, `mainnet`, `futurenet`, `local`. Unrecognised values fall back to `testnet` |
| `STELLAR_NETWORK_PASSPHRASE` | derived from `STELLAR_NETWORK`        | Overrides the passphrase used by the transaction submitter                                    |
| `RPC_URL`                    | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint used for on-chain session-key lookups                                    |
| `NETWORK_PASSPHRASE`         | `Test SDF Network ; September 2015`   | Passphrase used for those session-key lookups                                                 |

**Limits and timers**

| Variable                              | Default            | Description                                                               |
| ------------------------------------- | ------------------ | ------------------------------------------------------------------------- |
| `RELAY_RATE_LIMIT_RPM`                | `30`               | Per-**account** requests/minute on `/relay/execute` (429 + `Retry-After`) |
| `RELAY_RATE_LIMIT_MAX`                | `50`               | Per-**caller/IP** requests per 15-minute window on `/relay/*`             |
| `STATUS_RATE_LIMIT_MAX`               | `200`              | Per-IP requests per 15-minute window on `/relay/status`                   |
| `RELAY_MAX_PAYLOAD_BYTES`             | `524288` (512 KiB) | Request bodies above this are rejected before JSON parsing                |
| `SCHEDULER_POLL_INTERVAL_MS`          | `1000`             | Scheduled-transfer engine poll interval                                   |
| `SIGNATURE_SERVICE_HEALTH_TIMEOUT_MS` | `5000`             | Timeout for the signature-service health probe                            |

**Dev-only flags**

| Variable                      | Default | Description                                                    |
| ----------------------------- | ------- | -------------------------------------------------------------- |
| `RELAYER_USE_MOCK_SUBMISSION` | _unset_ | Set to the exact string `true` to enable mock mode — see below |

#### Mock mode — never enable outside local development

`RELAYER_USE_MOCK_SUBMISSION=true` makes `/relay/execute` **skip Stellar entirely**. Signature,
nonce, and rate-limit checks still run, but instead of building and submitting a transaction the
service returns a randomly generated `transactionId` with `gasUsed: 0` — an id that corresponds to
nothing on any network. `/relay/status` also reports RPC as healthy (`"Mock submission mode"`)
without contacting a node, so a broken RPC configuration looks fine.

That combination is exactly what you want for a fast local loop and exactly what you must not ship:
callers receive `success: true` for payments that never happened, and the health endpoint will not
tell you. Enable it only via a per-shell variable (as in [Option B](#option-b--pnpm-only-relayer-alone)),
never in a committed `.env` or deployment manifest. Mock-flag hardening — refusing to start with
mock mode on when `NODE_ENV=production`, and surfacing the flag in the status payload — is tracked in
[issue #968](https://github.com/ancore-org/ancore/issues/968).

The same warning applies to leaving `RELAYER_AUTH_SECRET` unset: the fallback stub auth service
accepts **any** non-empty Bearer token.

> **MVP note:** signature verification is real (`Ed25519SignatureService`), but nonce replay tracking
> and gas enforcement are not production-complete — see [Security Model](#security-model).

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
| `429`       | `RATE_LIMITED` — request rate limit exceeded per account (includes `Retry-After` header)              |
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

Per-account rate limiting is enforced via `createAccountRateLimiterMiddleware` (default: 30 requests/minute per account session key or address, configurable via `RELAY_RATE_LIMIT_RPM`).

When an account exceeds its limit, the relayer returns `HTTP 429 Too Many Requests` with:

- **Header:** `Retry-After: 60`
- **Body:** `{ "error": "RATE_LIMITED", "retryAfter": 60 }`

Note: uses in-memory store by default (unit-only unless a Redis store like `rate-limit-redis` is configured for multi-instance deployments).

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

For the full local stack (Postgres + indexer + relayer), env file setup, log tailing, and teardown,
see [Local Services Setup](../../docs/development/local-services.md) — summarised in
[Quickstart](#quickstart) above.

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
