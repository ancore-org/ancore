# Schema Assumptions and Migration Path

## Current Schema (v1)

### Table: account_activity

```sql
CREATE TABLE IF NOT EXISTS account_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id VARCHAR(56) NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    amount NUMERIC(20, 7),
    asset VARCHAR(100),
    counterparty VARCHAR(56),
    tx_hash VARCHAR(64) NOT NULL,
    ledger_seq BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB
);
```

### Schema Assumptions

1. **Account ID Format**: Stellar public keys (G-prefixed, 56 characters)
2. **Activity Types**: String-based enum values (payment, create_account, set_options, etc.)
3. **Amount Precision**: NUMERIC(20,7) supports up to 13 digits before decimal, 7 after
4. **Asset Format**: Either "XLM" for native or "CODE:ISSUER" for tokens
5. **Transaction Hash**: 64-character hex string
6. **Metadata**: Flexible JSONB for future extensibility
7. **Timestamps**: UTC with microsecond precision

### Index Strategy

- Primary query: `(account_id, created_at DESC)` - Time-ordered activity feeds
- Type filtering: `(account_id, activity_type, created_at DESC)` - Filtered feeds
- Ledger queries: `(account_id, ledger_seq DESC)` - Ledger-based queries
- Transaction lookup: `(tx_hash)` - Cross-account transaction details

## Migration Path to Production

### Phase 1: MVP (Current)
- Single table schema
- In-memory event processing
- Basic query endpoints
- Mock storage adapters

### Phase 2: Production Hardening
**Migration 002: Add Partitioning**
```sql
-- Partition by account_id for better performance at scale
CREATE TABLE account_activity_partitioned (
    LIKE account_activity INCLUDING ALL
) PARTITION BY HASH (account_id);

-- Create 8 partitions
CREATE TABLE account_activity_part_0 PARTITION OF account_activity_partitioned
    FOR VALUES WITH (modulus 8, remainder 0);
-- ... repeat for remainders 1-7
```

**Migration 003: Add Versioning**
```sql
ALTER TABLE account_activity ADD COLUMN schema_version INTEGER DEFAULT 1;
ALTER TABLE account_activity ADD COLUMN ingested_at TIMESTAMPTZ DEFAULT NOW();
```

**Migration 004: Enhanced Indexes**
```sql
-- Composite indexes for common query patterns
CREATE INDEX idx_account_activity_composite 
ON account_activity (account_id, activity_type, asset, created_at DESC);

-- Partial indexes for better performance
CREATE INDEX idx_account_activity_payments 
ON account_activity (account_id, created_at DESC) 
WHERE activity_type = 'payment';
```

### Phase 3: Scalability
**Migration 005: Add Event Sourcing**
```sql
-- Separate events table for audit trail
CREATE TABLE account_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id VARCHAR(56) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB NOT NULL,
    sequence_number BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);
```

**Migration 006: Add Materialized Views**
```sql
-- Pre-aggregated views for common queries
CREATE MATERIALIZED VIEW account_summary AS
SELECT 
    account_id,
    COUNT(*) as total_transactions,
    MAX(created_at) as last_activity,
    COUNT(DISTINCT activity_type) as activity_types
FROM account_activity 
GROUP BY account_id;
```

## Production Datastore Migration

### From Mock to PostgreSQL
1. **Data Export**: Export mock data to JSON/CSV format
2. **Schema Validation**: Ensure data conforms to production schema
3. **Bulk Import**: Use `COPY` command for efficient loading
4. **Index Rebuild**: Create indexes after data import
5. **Validation**: Run data integrity checks

### Migration Script Template
```bash
#!/bin/bash
# migration_v1_to_v2.sh

set -e

echo "Starting migration from v1 to v2..."

# 1. Backup current data
pg_dump $DATABASE_URL > backup_v1_$(date +%Y%m%d_%H%M%S).sql

# 2. Apply schema changes
psql $DATABASE_URL -f migrations/002_add_partitioning.sql
psql $DATABASE_URL -f migrations/003_add_versioning.sql

# 3. Migrate data (if needed)
# psql $DATABASE_URL -c "INSERT INTO account_activity_partitioned SELECT * FROM account_activity;"

# 4. Update indexes
psql $DATABASE_URL -f migrations/004_enhanced_indexes.sql

# 5. Validate migration
psql $DATABASE_URL -c "SELECT COUNT(*) FROM account_activity_partitioned;"

echo "Migration completed successfully!"
```

## Backward Compatibility

### API Versioning
- `/api/v1/` - Current MVP endpoints
- `/api/v2/` - Future production endpoints with enhanced features

### Data Migration Rules
1. **Never delete columns** - Add new columns with DEFAULT values
2. **Maintain old endpoints** - Support v1 clients during transition
3. **Feature flags** - Enable new features incrementally
4. **Rollback strategy** - Always have a rollback path

## Performance Considerations

### Query Optimization
- Use `EXPLAIN ANALYZE` to verify query plans
- Monitor index usage with `pg_stat_user_indexes`
- Consider `VACUUM ANALYZE` after large data imports

### Storage Optimization
- JSONB compression for metadata
- Table partitioning for large datasets
- Consider TimescaleDB for time-series optimization

## Monitoring and Alerting

### Key Metrics
- Query latency by endpoint
- Database connection pool usage
- Event ingestion lag
- Index hit ratios

### Health Checks
```sql
-- Simple health check
SELECT 1 as health_check;

-- Table size monitoring
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE tablename = 'account_activity';
```

## Security Considerations

### Data Protection
- Row-level security for multi-tenant scenarios
- Encryption at rest for sensitive metadata
- Audit logging for data access

### Access Control
```sql
-- Read-only user for query endpoints
CREATE USER indexer_read WITH PASSWORD 'secure_password';
GRANT SELECT ON account_activity TO indexer_read;

-- Write user for ingestion
CREATE USER indexer_write WITH PASSWORD 'secure_password';
GRANT INSERT, UPDATE ON account_activity TO indexer_write;
```
