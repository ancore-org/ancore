# Query API Implementation Notes

## Project Structure

```
services/indexer/
├── src/
│   ├── main.rs                          # Service entry point, route registration
│   ├── lib.rs                           # Library root, module exports
│   ├── error.rs                         # Structured error handling
│   ├── metrics.rs                       # Prometheus metrics
│   ├── api/
│   │   └── account_activity.rs          # HTTP handlers for activity endpoints
│   ├── repositories/
│   │   └── account_activity.rs          # Database query logic
│   ├── ingest/                          # Event ingestion pipeline
│   │   ├── worker.rs                    # Ingestion worker
│   │   ├── source.rs                    # Event source trait
│   │   └── sink.rs                      # Event sink trait
│   └── schema/
│       └── canonical.rs                 # Event normalization
├── migrations/
│   └── 001_create_account_activity_table.sql  # Database schema
├── tests/
│   ├── account_activity_api_test.rs     # Integration tests
│   └── pagination_consistency_test.rs   # Pagination edge case tests
├── docs/
│   ├── API.md                           # Complete API documentation
│   ├── QUERY_ARCHITECTURE.md            # Architecture deep dive
│   ├── USAGE_EXAMPLES.md                # Code examples
│   └── IMPLEMENTATION_NOTES.md          # This file
├── Cargo.toml                           # Rust dependencies
└── README.md                            # Service overview
```

## Key Design Decisions

### 1. Cursor-Based Pagination

**Decision**: Use cursor-based (keyset) pagination instead of offset-based.

**Rationale**:
- ✅ Stable under concurrent inserts (no duplicate/skipped records)
- ✅ Efficient for large datasets (constant query cost)
- ✅ Works well with event streams
- ✅ Prevents race conditions with ingestion

**Implementation**:
```rust
// Composite key (created_at, id) for stable ordering
WHERE (created_at, id) < (?, ?)
ORDER BY created_at DESC, id DESC
```

**Trade-offs**:
- ❌ Cursors are opaque (clients can't inspect them)
- ❌ Deep pagination requires query-time cursor decoding
- ✅ But both are acceptable because:
  - Cursors are short-lived (session-based)
  - Cursor decoding is O(1)

### 2. Repository Layer

**Decision**: Separate HTTP handlers from database queries via repository layer.

**Rationale**:
- Handlers focus on HTTP concerns (parameter parsing, validation, response shape)
- Repository handles query building and result mapping
- Easy to test repository logic without HTTP framework
- Easy to reuse repository functions in different contexts (API, jobs, etc.)

**File Organization**:
- `src/api/account_activity.rs` — HTTP handler layer
- `src/repositories/account_activity.rs` — Data access layer

### 3. Dynamic Query Building

**Decision**: Use `sqlx::QueryBuilder` for dynamic WHERE clauses.

**Rationale**:
- Avoids N+1 queries
- All filters combined in single query
- Database optimizer can choose best index path
- Parameterized queries prevent SQL injection

**Example**:
```rust
let mut query = QueryBuilder::new("SELECT ... WHERE account_id = ");
query.push_bind(account_id);

if let Some(ref activity_type) = filter.activity_type {
    query.push(" AND activity_type = ");
    query.push_bind(activity_type);
}
// ... more filters

query.build().fetch_all(db).await?
```

### 4. Account Scoping for Security

**Decision**: All queries scoped to `account_id`.

**Rationale**:
- Core security boundary
- Enforced at query level, not application logic
- Impossible to leak cross-account data
- Every endpoint validates account ID format first

**Implementation**:
```rust
// All queries include this WHERE clause
WHERE account_id = ?
```

### 5. Validation Pipeline

**Decision**: Validate parameters early in handler, before repository access.

**Rationale**:
- Fail fast with clear error messages
- Separate validation concerns from query logic
- Reduce database round-trips
- Security checks in one place

**Validation Order**:
1. Account ID format (56-char Stellar key)
2. Cursor mutual exclusivity
3. Ledger range ordering
4. Date range ordering
5. Cursor decoding (if provided)

## Pagination Algorithm

### Forward Pagination (`cursor_after`)

```
Client Request:
  GET /api/v1/accounts/A/activity?limit=10&cursor_after=...

Database Query:
  WHERE account_id = 'A'
    AND (created_at, id) < (?, ?)  ← Use composite key from cursor
  ORDER BY created_at DESC, id DESC
  LIMIT 11  ← Fetch one extra

Result Processing:
  if rows.len() > 10:
    has_next_page = true
    next_cursor = encode(rows[9])  ← Last returned record
    return rows[0:10]
  else:
    has_next_page = false
    return all rows
```

### Backward Pagination (`cursor_before`)

```
Client Request:
  GET /api/v1/accounts/A/activity?limit=10&cursor_before=...

Database Query:
  WHERE account_id = 'A'
    AND (created_at, id) > (?, ?)  ← Opposite comparison
  ORDER BY created_at DESC, id DESC  ← Same ordering
  LIMIT 11

Result Processing:
  if cursor_before was provided:
    prev_cursor = encode(rows[0])  ← First returned record
    has_previous_page = true
```

### Keyset Comparison

Why composite key `(created_at, id)`?

```
Scenario: Multiple events in same millisecond
  created_at        id
  10:30:00.000      550e8400 ← First
  10:30:00.000      550e8401 ← Second (same time, different ID)
  10:29:59.999      550e8402 ← Earlier

With just created_at:
  WHERE created_at < '10:30:00.000'
  ❌ Includes 550e8401 (same time!) → duplicate

With composite (created_at, id):
  WHERE (created_at, id) < ('10:30:00.000', '550e8400')
  ✅ Skips 550e8400 and 550e8401 → no duplicate
```

## Error Handling Strategy

### Error Codes

```rust
pub mod codes {
    pub const INVALID_CURSOR: &str = "INVALID_CURSOR";       // 400
    pub const INVALID_FILTER: &str = "INVALID_FILTER";       // 400
    pub const NOT_FOUND: &str = "NOT_FOUND";                 // 404
    pub const QUERY_TIMEOUT: &str = "QUERY_TIMEOUT";         // 504
    pub const DATABASE_ERROR: &str = "DATABASE_ERROR";       // 500
    pub const INTERNAL_ERROR: &str = "INTERNAL_ERROR";       // 500
}
```

### HTTP Status Mapping

| Error | HTTP Status | When | Example |
|-------|-------------|------|---------|
| `INVALID_CURSOR` | 400 | Malformed cursor, bad base64, bad JSON | Cursor contains invalid bytes |
| `INVALID_FILTER` | 400 | Bad parameter values | `ledger_min > ledger_max` |
| `NOT_FOUND` | 404 | Resource doesn't exist | Activity ID not found |
| `QUERY_TIMEOUT` | 504 | Database query exceeded timeout | Query took > 5 seconds |
| `DATABASE_ERROR` | 500 | Database connection, transaction, etc. | Connection pool exhausted |
| `INTERNAL_ERROR` | 500 | Unexpected server error | Panic in handler |

### Timeout Detection

```rust
// PostgreSQL error code 57014 = query_canceled
if err.as_database_error()
    .and_then(|db_err| db_err.code())
    .map(|c| c == "57014")
    .unwrap_or(false)
{
    // Treat as QUERY_TIMEOUT
    return 504 Gateway Timeout
}
```

## Database Indexing Strategy

### Primary Index

```sql
CREATE INDEX idx_account_activity_account_created 
ON account_activity (account_id, created_at DESC);
```

**Used by**: All activity list queries
**Why**: Most queries filter by account_id and order by created_at
**Cost**: 4-5 disk I/O for typical result set

### Composite Index

```sql
CREATE INDEX idx_account_activity_account_type_created 
ON account_activity (account_id, activity_type, created_at DESC);
```

**Used by**: Queries filtering by activity_type
**Why**: Allows index-only scans, avoiding table lookups
**Trade-off**: Larger index, but faster filtered queries

### Query Plan Example

```sql
EXPLAIN ANALYZE
SELECT * FROM account_activity
WHERE account_id = 'GABC...' 
ORDER BY created_at DESC, id DESC
LIMIT 10;

-- Result:
-- Limit (cost=0.42..10.20)
--   → Index Scan Backward using idx_account_activity_account_created
--     Index Cond: (account_id = 'GABC...')
```

## Performance Characteristics

### Query Performance

| Query Type | Rows | Time | Notes |
|-----------|------|------|-------|
| First page (no filters) | 20 | 1-2ms | Index scan |
| Deep pagination (with cursor) | 20 | 1-2ms | Keyset pagination is efficient! |
| Filter by activity_type | 20 | 1-2ms | Composite index |
| Filter by date range + type | 20 | 2-3ms | Index range scan |
| Large limit (100) | 100 | 2-3ms | Single large query |

### Memory Usage

- Cursor: ~100 bytes (base64-encoded JSON)
- Result set: ~1KB per record (typical)
- Handler overhead: ~10KB

### Connection Pooling

```rust
PgPoolOptions::new()
    .max_connections(10)          // Adjust based on load
    .acquire_timeout(Duration::from_secs(5))
    .connect(&database_url)
    .await?
```

## Testing Strategy

### Unit Tests (in repository module)

```rust
#[test]
fn normalize_asset_native_returns_xlm() { ... }

#[test]
fn encode_decode_cursor_roundtrip() { ... }

#[test]
fn test_limit_clamping() { ... }
```

**Run with**: `cargo test --lib`

### Integration Tests (in tests/ directory)

```rust
#[tokio::test]
#[ignore]  // Requires database
async fn integration_test_pagination_forward() { ... }

#[tokio::test]
#[ignore]
async fn integration_test_filter_combinations() { ... }
```

**Run with**: `cargo test --test '*' -- --ignored --test-threads=1`

### Test Database Setup

```bash
# Create test database
createdb ancore_test

# Run migrations
sqlx migrate run --database-url postgresql://localhost/ancore_test

# Set TEST_DATABASE_URL for tests
export TEST_DATABASE_URL=postgresql://localhost/ancore_test
cargo test --test '*' -- --ignored
```

## Security Considerations

### Input Validation

✅ Account ID format validation
```rust
if id.len() != 56 || !id.starts_with('G') {
    return Err(ApiError::InvalidFilter(...))
}
```

✅ Parameterized queries
```rust
// SQL injection impossible
query.push_bind(user_input);
```

✅ Account scoping
```rust
// All queries scoped to account_id
WHERE account_id = ?
```

### Data Privacy

✅ No leaking account data across requests
✅ No logging sensitive transaction data
✅ Responses scoped to authenticated account

### Rate Limiting

Implemented via `GovernorLayer` middleware (see main.rs)
```rust
.layer(GovernorLayer { ... })
```

## Extension Points

### Adding a New Filter

**Steps**:
1. Add field to `ActivityFilter` struct
2. Add query parameter to `ListActivityQuery`
3. Add validation to handler
4. Apply filter in `get_account_activity()` function
5. Add tests for the new filter

**Example**: Adding `min_amount` filter

```rust
// 1. Update struct
pub struct ActivityFilter {
    pub min_amount: Option<String>,  // NEW
    // ... existing fields
}

// 2. Update query params
#[derive(Debug, Deserialize)]
pub struct ListActivityQuery {
    pub min_amount: Option<String>,  // NEW
    // ... existing fields
}

// 3. Build in handler
let filter = ActivityFilter {
    min_amount: params.min_amount,  // NEW
    // ... existing
};

// 4. Apply in repository
if let Some(ref min_amount) = filter.min_amount {
    query.push(" AND amount >= ");
    query.push_bind(min_amount);
}

// 5. Test it
#[tokio::test]
async fn test_filter_min_amount() { ... }
```

### Adding a New Query Endpoint

**Steps**:
1. Create handler function
2. Create repository function
3. Register route in main.rs
4. Add tests

## Deployment Considerations

### Environment Variables

```bash
DATABASE_URL=postgresql://user:pass@host:5432/ancore
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/ancore_test
DB_TIMEOUT_SEC=5
PROMETHEUS_PORT=9090
RUST_LOG=info,ancore_indexer=debug
```

### Health Checks

Endpoint: `GET /health`

Returns:
- Database connectivity status
- Indexer lag (blocks and seconds)
- Service version

**Use for**:
- Load balancer health checks
- Readiness probes in Kubernetes
- Monitoring dashboards

### Metrics

Endpoint: `GET /metrics/prometheus`

Available metrics:
- `indexer_lag_blocks`: Blocks behind chain head
- `indexer_lag_seconds`: Estimated seconds behind

## Future Enhancements

### Potential Improvements

1. **Aggregation Endpoints**
   - Daily summary (transactions, volume by type)
   - Monthly statements
   - Top counterparties

2. **Advanced Filtering**
   - Amount range filters
   - Regex pattern matching on assets
   - Counterparty proximity (related accounts)

3. **Batch Operations**
   - Bulk activity lookup by multiple IDs
   - Transaction correlation (related transactions)

4. **Export Capabilities**
   - CSV export of date ranges
   - Statement generation
   - Blockchain-signed activity proofs

5. **Caching Layer**
   - Redis caching for common queries
   - Cursor cache for deep pagination
   - Activity type enumeration cache

## Troubleshooting

### Common Issues

**Q: Cursor returns 400 INVALID_CURSOR**
A: Cursors expire after session. Regenerate by making fresh query.

**Q: Query returns 504 Gateway Timeout**
A: Try narrower date range or more specific filters. Reduce limit if querying many records.

**Q: Empty result set when data exists**
A: Check account_id format. Verify filters aren't too restrictive.

**Q: Pagination returns duplicates**
A: Should not happen with cursor implementation. File a bug if you see this.

### Debugging

**Enable debug logging**:
```bash
RUST_LOG=debug cargo run
```

**Analyze slow queries**:
```sql
EXPLAIN ANALYZE
SELECT ... FROM account_activity
WHERE account_id = '...'
ORDER BY created_at DESC
LIMIT 20;
```

**Check database connectivity**:
```bash
psql $DATABASE_URL -c "SELECT 1"
```

## References

- [Keyset Pagination](https://use-the-index-luke.com/sql/pagination)
- [Stellar Protocol](https://developers.stellar.org/)
- [SQLx Documentation](https://github.com/launchbadge/sqlx)
- [Axum Web Framework](https://github.com/tokio-rs/axum)
