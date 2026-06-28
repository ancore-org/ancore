# Local Services Development

This guide explains how to run the full Ancore service stack locally using Docker Compose.

## Overview

The `docker-compose.dev.yml` stack provides:

- **PostgreSQL 16**: Database for the indexer
- **Indexer Service**: Blockchain indexer with REST API
- **Relayer Service**: Transaction relay service

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- 4GB+ available RAM
- Ports 3000, 3001, 5432, 9090 available

## Quick Start

### 1. Start the Stack

```bash
# From repository root
docker compose -f docker-compose.dev.yml up
```

This will:
- Pull the PostgreSQL image
- Build the indexer and relayer services
- Start all containers with health checks
- Expose services on localhost

### 2. Verify Services

```bash
# Check PostgreSQL
psql postgres://postgres:ancore@localhost:5432/ancore_indexer -c "SELECT version();"

# Check indexer health
curl http://localhost:3000/health

# Check indexer Prometheus metrics
curl http://localhost:9090/metrics

# Check relayer status
curl http://localhost:3001/relay/status
```

### 3. Run Indexer Migrations

The indexer requires database migrations to be run before it can operate:

```bash
# Option 1: Run migrations inside the container
docker compose -f docker-compose.dev.yml exec indexer \
  psql $DATABASE_URL -f migrations/001_create_account_activity_table.sql

docker compose -f docker-compose.dev.yml exec indexer \
  psql $DATABASE_URL -f migrations/002_create_ingest_checkpoints_table.sql

# Option 2: Run migrations from host (requires psql)
psql postgres://postgres:ancore@localhost:5432/ancore_indexer \
  -f services/indexer/migrations/001_create_account_activity_table.sql

psql postgres://postgres:ancore@localhost:5432/ancore_indexer \
  -f services/indexer/migrations/002_create_ingest_checkpoints_table.sql

# Option 3: Use sqlx CLI (if installed)
cd services/indexer
DATABASE_URL=postgres://postgres:ancore@localhost:5432/ancore_indexer \
  sqlx migrate run
```

## Service Details

### PostgreSQL

- **Host Port**: 5432
- **Container**: `ancore-postgres`
- **Database**: `ancore_indexer`
- **User**: `postgres`
- **Password**: `ancore`
- **Connection String**: `postgres://postgres:ancore@localhost:5432/ancore_indexer`

**Data Persistence**: Data is stored in a Docker volume (`postgres_data`) and persists across container restarts.

### Indexer

- **API Port**: 3000
- **Metrics Port**: 9090
- **Container**: `ancore-indexer`
- **Health Check**: `GET http://localhost:3000/health`

**Endpoints**:
- `GET /health` - Health status with lag metrics
- `GET /metrics` - JSON metrics (cursor staleness)
- `GET /api/v1/accounts/:account_id/activity` - Transaction history
- Prometheus metrics on port 9090

**Environment Variables**:
- `DATABASE_URL` - PostgreSQL connection string
- `PROMETHEUS_PORT` - Metrics port (default: 9090)
- `RUST_LOG` - Log level (info, debug, trace)

### Relayer

- **Host Port**: 3001
- **Container**: `ancore-relayer`
- **Health Check**: `GET http://localhost:3001/relay/status`

**Endpoints**:
- `GET /relay/status` - Service status
- `POST /relay/submit` - Submit transaction

**Environment Variables**:
- `PORT` - Service port (default: 3000, mapped to 3001 on host)
- `NODE_ENV` - Environment (development, production)
- `STELLAR_NETWORK` - Stellar network (testnet, mainnet)
- `STELLAR_HORIZON_URL` - Horizon API URL

## Configuration

### Custom Environment Variables

Create a `.env.docker` file from the example:

```bash
cp .env.docker.example .env.docker
```

Then edit `.env.docker` with your configuration. Docker Compose will automatically load it.

### Custom Ports

If default ports conflict with existing services, modify `docker-compose.dev.yml`:

```yaml
services:
  postgres:
    ports:
      - '15432:5432'  # Use port 15432 on host
  
  indexer:
    ports:
      - '13000:3000'  # Use port 13000 on host
      - '19090:9090'  # Use port 19090 on host
  
  relayer:
    ports:
      - '13001:3000'  # Use port 13001 on host
```

## Development Workflow

### Rebuild After Code Changes

```bash
# Rebuild and restart a specific service
docker compose -f docker-compose.dev.yml up --build indexer

# Rebuild all services
docker compose -f docker-compose.dev.yml up --build
```

### View Logs

```bash
# All services
docker compose -f docker-compose.dev.yml logs -f

# Specific service
docker compose -f docker-compose.dev.yml logs -f indexer

# Last 100 lines
docker compose -f docker-compose.dev.yml logs --tail=100 relayer
```

### Execute Commands in Containers

```bash
# Open shell in indexer container
docker compose -f docker-compose.dev.yml exec indexer sh

# Run psql in postgres container
docker compose -f docker-compose.dev.yml exec postgres psql -U postgres -d ancore_indexer

# Check indexer binary version
docker compose -f docker-compose.dev.yml exec indexer ancore-indexer --version
```

### Database Operations

```bash
# Connect to database
docker compose -f docker-compose.dev.yml exec postgres \
  psql -U postgres -d ancore_indexer

# Backup database
docker compose -f docker-compose.dev.yml exec postgres \
  pg_dump -U postgres ancore_indexer > backup.sql

# Restore database
docker compose -f docker-compose.dev.yml exec -T postgres \
  psql -U postgres -d ancore_indexer < backup.sql

# Reset database (WARNING: destroys all data)
docker compose -f docker-compose.dev.yml exec postgres \
  psql -U postgres -c "DROP DATABASE ancore_indexer; CREATE DATABASE ancore_indexer;"
```

## Teardown

### Stop Services (Keep Data)

```bash
docker compose -f docker-compose.dev.yml down
```

This stops and removes containers but preserves the `postgres_data` volume.

### Stop and Remove All Data

```bash
docker compose -f docker-compose.dev.yml down -v
```

This removes containers **and** the PostgreSQL data volume.

### Clean Up Everything

```bash
# Remove containers, volumes, and images
docker compose -f docker-compose.dev.yml down -v --rmi all

# Remove orphaned volumes
docker volume prune
```

## Troubleshooting

### Port Already in Use

If you see "port is already allocated":

1. Check what's using the port:
   ```bash
   # Windows
   netstat -ano | findstr :3000
   
   # Linux/Mac
   lsof -i :3000
   ```

2. Either stop the conflicting service or use custom ports (see Configuration above)

### Indexer Won't Start

Check the logs:
```bash
docker compose -f docker-compose.dev.yml logs indexer
```

Common issues:
- **Database connection failed**: Ensure postgres is healthy
- **Migrations not run**: Run migrations (see Quick Start step 3)
- **Port conflict**: Change ports in docker-compose.dev.yml

### PostgreSQL Connection Refused

Ensure the postgres service is healthy:
```bash
docker compose -f docker-compose.dev.yml ps postgres
```

If unhealthy, check logs:
```bash
docker compose -f docker-compose.dev.yml logs postgres
```

### Build Failures

Clear Docker cache and rebuild:
```bash
docker compose -f docker-compose.dev.yml build --no-cache
```

### Out of Disk Space

Clean up Docker resources:
```bash
docker system prune -a --volumes
```

## Integration with Applications

### Extension Wallet

Update `apps/extension-wallet/.env`:
```bash
VITE_INDEXER_URL=http://localhost:3000
VITE_RELAYER_URL=http://localhost:3001
```

### Mobile Wallet

Update `apps/mobile-wallet/.env`:
```bash
EXPO_PUBLIC_INDEXER_URL=http://localhost:3000
EXPO_PUBLIC_RELAYER_URL=http://localhost:3001
```

### Web Dashboard

Update `apps/web-dashboard/.env`:
```bash
VITE_INDEXER_URL=http://localhost:3000
VITE_RELAYER_URL=http://localhost:3001
```

## Production Considerations

This docker-compose stack is **for development only**. For production:

- Use managed PostgreSQL (AWS RDS, Google Cloud SQL, etc.)
- Configure proper secrets management
- Set up monitoring and alerting
- Use container orchestration (Kubernetes, ECS, etc.)
- Configure proper networking and security groups
- Enable SSL/TLS for all services
- Set up automated backups
- Configure log aggregation

See [docs/ops/README.md](../ops/README.md) for observability configuration.

## Next Steps

- [Indexer API Documentation](../../services/indexer/README.md)
- [Relayer API Documentation](../../services/relayer/README.md)
- [Ops overview](../ops/README.md)
- [SLO definitions](../ops/slo-definitions.md)
