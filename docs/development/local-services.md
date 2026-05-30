# Local Services Setup

This guide explains how to set up and run Ancore services locally for full-stack development.

## Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- curl (for health checks)

## Services Overview

| Service | Port | Purpose | Status |
|---------|------|---------|--------|
| **Indexer** | 8080 | Blockchain data indexing & GraphQL API | ✓ Available |
| **Relayer** | 3001 | Transaction relay & execution | ✓ Available |
| **AI Agent** | 3002 | Intent validation & workflow orchestration | ✓ Available (scaffold) |

## Environment Setup

### 1. Copy Environment File

```bash
cp .env.example .env.local
```

This creates a local environment file with default values pointing to localhost services.

### 2. Review Service URLs

Open `.env.local` and verify service URLs match your setup:

```bash
INDEXER_URL=http://localhost:8080
RELAYER_URL=http://localhost:3001
AI_AGENT_URL=http://localhost:3002
```

## Starting Services

### Start All Services (Terminal Sessions)

In separate terminal windows, run:

```bash
# Terminal 1: Indexer
pnpm --filter @ancore/indexer dev

# Terminal 2: Relayer
pnpm --filter @ancore/relayer dev

# Terminal 3: AI Agent
pnpm --filter @ancore/ai-agent dev
```

### Validate Service Health

Once all services are running, validate they're healthy:

```bash
make validate-env
```

Or manually:

```bash
curl http://localhost:8080/health
curl http://localhost:3001/health
curl http://localhost:3002/health
```

## Service Details

### Indexer (Port 8080)

Provides blockchain data indexing and GraphQL API.

**Key Endpoints:**

- `GET /health` — Health check
- `GET /graphql` — GraphQL playground
- `POST /graphql` — GraphQL queries

**Environment Variables:**

```bash
# In .env.local or service .env
INDEXER_PORT=8080
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK=testnet
```

**Start Development:**

```bash
pnpm --filter @ancore/indexer dev
```

**Read More:**

- [Indexer README](../../services/indexer/README.md)

### Relayer (Port 3001)

Handles transaction relay and smart account operations.

**Key Endpoints:**

- `GET /health` — Health check
- `POST /v1/transactions/relay` — Submit transactions

**Environment Variables:**

```bash
# In .env.local or service .env
RELAYER_PORT=3001
INDEXER_URL=http://localhost:8080
```

**Start Development:**

```bash
pnpm --filter @ancore/relayer dev
```

**Read More:**

- [Relayer README](../../services/relayer/README.md)

### AI Agent (Port 3002)

Validates intents and orchestrates financial workflows (currently scaffold with health endpoint).

**Key Endpoints:**

- `GET /health` — Health check
- `POST /v1/intents/validate` — Intent validation (under development)

**Environment Variables:**

```bash
# In .env.local or service .env
PORT=3002
```

**Start Development:**

```bash
pnpm --filter @ancore/ai-agent dev
```

**Read More:**

- [AI Agent README](../../services/ai-agent/README.md)

## App Configuration

### Extension Wallet

Uses these environment variables:

```bash
REACT_APP_INDEXER_URL=http://localhost:8080
REACT_APP_RELAYER_URL=http://localhost:3001
REACT_APP_AI_AGENT_URL=http://localhost:3002
```

Set in `.env` in `apps/extension-wallet/` before starting.

### Mobile Wallet

Uses Expo public environment variables:

```bash
EXPO_PUBLIC_INDEXER_URL=http://localhost:8080
EXPO_PUBLIC_RELAYER_URL=http://localhost:3001
EXPO_PUBLIC_AI_AGENT_URL=http://localhost:3002
```

Set in `.env.local` in `apps/mobile-wallet/` before starting.

See [Mobile Wallet README](../../apps/mobile-wallet/README.md).

### Web Dashboard

Uses Vite environment variables:

```bash
VITE_INDEXER_URL=http://localhost:8080
VITE_RELAYER_URL=http://localhost:3001
VITE_AI_AGENT_URL=http://localhost:3002
```

Set in `.env` in `apps/web-dashboard/` before starting.

## Docker Compose (Optional)

For container-based local development:

```bash
docker-compose up -d
```

Services will be available on the same ports. Update `.env.local` if using Docker hostnames (e.g., `http://indexer:8080`).

See [docker-compose.yml](../../docker-compose.yml) for configuration.

## Troubleshooting

### Service Won't Start

**Check Node.js version:**

```bash
node --version  # Should be >= 20.0.0
```

**Check pnpm version:**

```bash
pnpm --version  # Should be >= 9.0.0
```

**Clear cache:**

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Connection Refused

**Check if service is running:**

```bash
curl -v http://localhost:8080/health
```

**Verify URL in .env.local:**

```bash
grep INDEXER_URL .env.local
```

**Check port conflict:**

```bash
lsof -i :8080  # Check port 8080 in use
```

### Service Crashes on Startup

**Check logs:**

```bash
pnpm --filter @ancore/indexer dev 2>&1 | head -50
```

**Check environment variables:**

```bash
env | grep INDEXER  # Verify env vars are set
```

## Health Check Command

Quick validation of all services:

```bash
make validate-env
```

This runs the validation script and reports the status of all configured services.

## Docker Compose Smoke Test

After running `docker-compose up`, use the smoke test script to verify all services are healthy:

```bash
bash scripts/dev/smoke-stack.sh
```

This script:
- Waits for services to become healthy (30-second timeout)
- Checks Indexer health endpoint (http://localhost:8080/health)
- Checks Relayer status endpoint (http://localhost:3000/relay/status)
- Exits with code 0 when all services are healthy
- Exits with code 1 if timeout is reached or services fail health checks

**Usage with Docker Compose:**

```bash
# Start services
docker-compose up -d

# Run smoke test to verify health
bash scripts/dev/smoke-stack.sh

# Check logs if services are not healthy
docker-compose logs
```

**CI Integration:**

The smoke test can be integrated into CI pipelines as an optional job to verify docker-compose stack health after deployment.

## Next Steps

- [Read Extension Wallet guide](../../apps/extension-wallet/README.md)
- [Read Mobile Wallet guide](../../apps/mobile-wallet/README.md)
- [Read Web Dashboard guide](../../apps/web-dashboard/README.md)
- [View Contract Documentation](../../docs/README.md)

## Related Issues

- [#565](https://github.com/ancore-org/ancore/issues/565) - AI Agent health & intent validation
- [#620](https://github.com/ancore-org/ancore/issues/620) - Mobile wallet dev setup
- [#666](https://github.com/ancore-org/ancore/issues/666) - Makefile targets
- [#669](https://github.com/ancore-org/ancore/issues/669) - Full-stack .env setup
- [#683](https://github.com/ancore-org/ancore/issues/683) - Docker Compose smoke test script
