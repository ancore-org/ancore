# @ancore/ai-agent

AI-assisted financial workflow orchestration service for the Ancore account abstraction layer.

---

## Status

**MVP** — health, draft-intent, and intent validation routes are implemented. The service drafts intents only; it never executes transactions autonomously (`requiresConfirmation` is always enforced).

---

## Deployment Requirements

| Requirement     | Value                            |
| --------------- | -------------------------------- |
| Node.js         | >= 20.0.0                        |
| Package manager | pnpm >= 9.0.0                    |
| Port            | `PORT` env var (default: `3001`) |

---

## Environment Variables

| Variable          | Required | Default      | Description                                        |
| ----------------- | -------- | ------------ | -------------------------------------------------- |
| `PORT`            | No       | `3001`       | HTTP listen port                                   |
| `NODE_ENV`        | No       | `production` | Runtime environment (`production` / `development`) |
| `SERVICE_VERSION` | No       | `0.1.0`      | Version string returned by the `/health` endpoint  |

---

## API

### `GET /health`

Health probe used by Docker HEALTHCHECK and load-balancer readiness checks.
No authentication required.

**Response `200`:**

```json
{
  "status": "ok",
  "uptime": 42,
  "timestamp": "2026-05-29T14:00:00.000Z",
  "service": "ai-agent",
  "version": "0.1.0"
}
```

### `POST /v1/intents/validate`

Validates agent-extracted intents.

**Supported Intents:**

1. **Payment Intent (`payment`):** Transfer funds. Requires `amount`, `asset` (`XLM` or `USDC`), and `destination`.
2. **Invoice Intent (`invoice`):** Request invoice creation. Requires `amount`, `asset` (`XLM` or `USDC`), `recipient` (supports Unicode multilingual), and `dueDate` (valid parseable date).

**Response `200` (Valid):**

```json
{
  "valid": true,
  "intent": {
    "type": "invoice",
    "amount": "150.00",
    "asset": "USDC",
    "recipient": "Alice",
    "dueDate": "2026-12-31T23:59:59Z"
  }
}
```

**Response `400` (Invalid):**

```json
{
  "errors": {
    "fieldErrors": {
      "dueDate": ["Required"]
    }
  }
}
```

---

## Running with Docker

### Build the image

```bash
docker build -t ancore/ai-agent:latest services/ai-agent
```

### Run the container

```bash
docker run -d \
  --name ai-agent \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e SERVICE_VERSION=0.1.0 \
  ancore/ai-agent:latest
```

### Verify the health endpoint

```bash
curl http://localhost:3001/health
```

### Check container health status

```bash
docker inspect --format='{{.State.Health.Status}}' ai-agent
```

---

## Development

```bash
# Install dependencies (from repo root)
pnpm install

# Build
pnpm --filter @ancore/ai-agent build

# Run tests
pnpm --filter @ancore/ai-agent test

# Start (development, requires ts-node)
pnpm --filter @ancore/ai-agent dev
```

---

## Logging

All requests are logged as structured JSON objects to `stdout` by a request logger middleware.

### Privacy and Redaction

To prevent PII and prompt leaks, the logging system automatically redacts sensitive fields like `prompt` and `freeText` from all log output, even when `NODE_ENV` is not production. If you run the service with debug logging enabled, the full request bodies will still never expose user prompts.

**Example log entry:**

```json
{
  "level": "info",
  "timestamp": "2026-05-31T14:00:00.000Z",
  "message": "request_complete",
  "route": "/agent/draft-intent",
  "method": "POST",
  "statusCode": 200,
  "durationMs": 42,
  "accountId": "123",
  "intentType": "payment"
}
```

---

## Docker Design

The Dockerfile uses a **three-stage multi-stage build**:

| Stage     | Base image       | Purpose                                |
| --------- | ---------------- | -------------------------------------- |
| `build`   | `node:20-alpine` | Compile TypeScript → `dist/`           |
| `deps`    | `node:20-alpine` | Install production-only `node_modules` |
| `runtime` | `node:20-alpine` | Minimal runtime; runs as non-root user |

Security properties of the runtime image:

- Runs as a **non-root user** (`ancore:ancore`, created at build time)
- Only production dependencies are present — no TypeScript compiler, no test tools
- `curl` is installed solely for the HEALTHCHECK probe

---

## Planned Responsibilities

- Natural-language to financial action intent parsing
- Safety checks and user confirmation flows
- Draft invoice / payment request generation
- Routing to off-chain analytics / risk systems before settlement
