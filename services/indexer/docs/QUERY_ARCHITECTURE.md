# Query API Architecture

## Overview

The Indexer Query API provides independent, decoupled query endpoints for account activity data. The architecture separates concerns into distinct layers:

```
┌─────────────────────────────────────────────────────────┐
│                   HTTP Request Layer                     │
│              (Axum Handlers, Route Binding)             │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│                  API Handler Layer                       │
│    (Parameter Parsing, Validation, Response Shape)     │
│         (src/api/account_activity.rs)                  │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│               Repository Layer                           │
│   (Query Building, Cursor Pagination, Filtering)       │
│    (src/repositories/account_activity.rs)              │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│                  Database Layer                          │
│          (PostgreSQL, SQL Queries, Indexes)            │
│       (migrations/001_create_account_activity_table.sql)│
└──────────────────────────────────────────────────────────┘
```

## Design Principles

### 1. Query Independence

Query endpoints are completely independent from ingestion logic:

- **Ingestion** (`src/ingest/`): Fetches, normalizes, and persists events
- **Query API** (`src/api/`, `src/repositories/`): Serves data from the database

This separation allows:
- Independent scaling (read vs. write workloads)
- Different timeout/performance tuning per layer
- Query logic can be modified without affecting ingestion
- Easy to add new query patterns without touching the ingest pipeline

### 2. Cursor-Based Pagination

Uses **keyset (seek) pagination** instead of offset-based:

```
┌─────────────────────────────────────────────────────────┐
│ Time-ordered activity records (DESC):                   │
│ created_at          id                                  │
│ 2024-01-15 10:32   550e84xx ... (cursor here)           │
│ 2024-01-15 10:31   550e83xx                             │
│ 2024-01-15 10:30   550e82xx                             │
│ 2024-01-15 10:29   550e81xx                             │
│ 2024-01-15 10:28   550e80xx                             │
└─────────────────────────────────────────────────────────┘
```

**Cursor Structure** (base64url-encoded JSON):
```json
{
  "t": "2024-01-15T10:32:00Z",  // RFC 3339 timestamp
  "i": "550e84xx-xxxx-xxxx-xxxx-xxxxxxxx"  // Record UUID
}
```

**Advantages**:
- ✅ Stable under concurrent inserts (no row skipping/duplication)
- ✅ Efficient queries (no need to scan/skip N rows)
- ✅ Memory-efficient (constant query cost)
- ✅ Works correctly for "Load more" UX patterns

### 3. Composite Key Ordering

Pagination uses a **composite key** `(created_at, id)` to handle ties:

```sql
WHERE (created_at, id) < ('2024-01-15T10:32:00Z', '550e84xx-...')
ORDER BY created_at DESC, id DESC
```

**Why composite?**
- Multiple events can occur in the same millisecond
- UUID as tiebreaker ensures stable ordering
- Prevents race conditions with concurrent ingestion

### 4. Account Scoping for Security

All queries are scoped to a specific account:

```sql
SELECT ... FROM account_activity 
WHERE account_id = 'GABC...' AND ...
```

**Security properties**:
- A query for `account_id=A` cannot leak data for `account_id=B`
- Account isolation is enforced at query level, not application logic
- Every endpoint validates the account ID format before querying

### 5. Dynamic Query Building

Filters are applied dynamically to avoid N+1 queries:

```rust
// Build query with only requested filters
let mut query = QueryBuilder::new("SELECT ... WHERE account_id = ?");
query.push_bind(account_id);

if let Some(ref activity_type) = filter.activity_type {
    query.push(" AND activity_type = ?");
    query.push_bind(activity_type);
}

// ... more filters

query.push(" ORDER BY created_at DESC, id DESC LIMIT ?");
query.push(limit);

let rows = query.build().fetch_all(db).await?;
```

**Benefits**:
- Single query with all filters combined
- No additional round-trips to the database
- Easier to optimize (database can choose best index path)

## Data Flow

### List Account Activity Flow

```
1. Client Request
   GET /api/v1/accounts/{account_id}/activity?...
        │
        ▼
2. Handler Layer (src/api/account_activity.rs)
   - Parse path: account_id
   - Parse query params: filters, pagination
   - Validate:
     * Account ID format (56-char Stellar key)
     * Cursor mutual exclusivity
     * Ledger range (min <= max)
     * Date range (from_date <= to_date)
   - Parse ISO 8601 datetime strings
        │
        ▼
3. Repository Layer (src/repositories/account_activity.rs)
   - Decode cursor (base64 decode → JSON parse → extract t, i)
   - Build dynamic SQL query with filters
   - Execute query with parameterized bindings
        │
        ▼
4. Database Layer (PostgreSQL)
   - Query: SELECT ... FROM account_activity
     WHERE account_id = ? 
     AND (created_at, id) < (?, ?)  [if cursor_after]
     AND activity_type = ?  [if filter set]
     ... [other filters]
     ORDER BY created_at DESC, id DESC
     LIMIT ? + 1  [fetch one extra to detect next page]
   - Use indexes: (account_id, created_at DESC) or
                  (account_id, activity_type, created_at DESC)
        │
        ▼
5. Pagination Detection
   - If rows.len() > limit:
     has_next_page = true
     next_cursor = encode(last_row.created_at, last_row.id)
   - Trim results to limit
        │
        ▼
6. Response Envelope
   {
     "data": [ActivityRecord],
     "pagination": {
       "has_next_page": bool,
       "has_previous_page": bool,
       "next_cursor": "...",
       "prev_cursor": "...",
       "count": usize
     }
   }
```

### Error Handling Flow

```
ValidationError → Handler validation layer
   ▼
→ Returns 400 Bad Request with error code

DecodingError (invalid cursor) → Repository layer
   ▼
→ Returns 400 Bad Request (INVALID_CURSOR)

DatabaseError (timeout) → Error handler
   ▼
→ Detects code 57014 (database query timeout)
→ Returns 504 Gateway Timeout

DatabaseError (other) → Error handler
   ▼
→ Logs error
→ Returns 500 Internal Server Error
```

## Database Layer

### Table Schema

```sql
CREATE TABLE account_activity (
    id UUID PRIMARY KEY,
    account_id VARCHAR(56) NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    amount NUMERIC(20, 7),
    asset VARCHAR(100),
    asset_code VARCHAR(12),
    asset_issuer VARCHAR(56),
    counterparty VARCHAR(56),
    tx_hash VARCHAR(64) NOT NULL,
    ledger_seq BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    metadata JSONB
);
```

### Indexes

**Index 1: Primary activity feed (time-ordered)**
```sql
CREATE INDEX idx_account_activity_account_created 
ON account_activity (account_id, created_at DESC);
```
- Used by: All queries with this account
- Cost: ~4-5 disk I/O for typical result set

**Index 2: Filtered by activity type**
```sql
CREATE INDEX idx_account_activity_account_type_created 
ON account_activity (account_id, activity_type, created_at DESC);
```
- Used by: Queries filtering by activity_type
- Allows index-only scans for common filters

**Query Plans** (typical):
```
Limit (cost=0.42..10.20)
  → Index Scan using idx_account_activity_account_created (cost=0.42..10.20)
    Index Cond: (account_id = $1) AND ((created_at, id) < ($2, $3))
    -> LIMIT 21  [one extra to detect next page]
```

### Performance Characteristics

| Query Pattern | Rows | Time | Index Used |
|---------------|------|------|-----------|
| No filters, first page | 20 | 1-2ms | account_created |
| No filters, deep cursor | 20 | 1-2ms | account_created (cursor efficient!) |
| Filter: activity_type | 20 | 1-2ms | account_type_created |
| Filter: activity_type + date range | 20 | 2-3ms | account_type_created |
| No filters, limit=100 | 100 | 2-3ms | account_created |

**Key insight**: Keyset pagination makes deep pagination as fast as first page.

## Validation Pipeline

### Account ID Validation

```rust
// Stellar account addresses are exactly 56 characters
// Format: 'G' (1 char) + base32 data (55 chars)
if account_id.len() != 56 || !account_id.starts_with('G') {
    return Err(ApiError::InvalidFilter("...".to_string()))
}
```

### Date Range Validation

```rust
if let (Some(from), Some(to)) = (filter.from_date, filter.to_date) {
    // Dates must be ordered correctly for the query to make sense
    if from > to {
        return Err(ApiError::InvalidFilter("from_date > to_date".to_string()))
    }
}
```

### Ledger Range Validation

```rust
if let (Some(min), Some(max)) = (filter.ledger_min, filter.ledger_max) {
    if min > max {
        return Err(ApiError::InvalidFilter("ledger_min > ledger_max".to_string()))
    }
}
```

### Cursor Validation

```rust
// Decode from base64url → UTF-8 → JSON
// Each step can fail with specific error
let decoded = base64::decode(cursor)
    .map_err(|_| ApiError::InvalidCursor("Invalid base64".to_string()))?;
let json_str = String::from_utf8(decoded)
    .map_err(|_| ApiError::InvalidCursor("Invalid UTF-8".to_string()))?;
let cursor_obj: DecodedCursor = serde_json::from_str(json_str)
    .map_err(|_| ApiError::InvalidCursor("Invalid JSON".to_string()))?;
```

## Testing Strategy

### Unit Tests (src/repositories/account_activity.rs)

```
normalize_asset()
  ✓ None → (None, None)
  ✓ "native" → ("XLM", None)
  ✓ "USDC:ISSUER" → ("USDC", "ISSUER")
  
encode/decode_cursor()
  ✓ Roundtrip preserves data
  ✓ Malformed input returns error
  ✓ Invalid JSON returns error
```

### Integration Tests (tests/account_activity_api_test.rs)

```
API Behavior
  ✓ List activity happy path
  ✓ List with all filters
  ✓ Pagination forward
  ✓ Both cursors returns 400
  ✓ Invalid cursor returns 400
  ✓ Limit clamping
  ✓ Get by ID found
  ✓ Get by ID not found
  ✓ Account not found returns empty
  ✓ Get types
  ✓ Invalid account ID returns 400
  ✓ Invalid ledger range returns 400
```

## Extension Points

### Adding New Filters

**Example: Add `min_amount` filter**

1. Update query parameter struct:
```rust
#[derive(Debug, Deserialize)]
pub struct ListActivityQuery {
    // ... existing
    min_amount: Option<String>,  // NEW
}
```

2. Update filter struct:
```rust
pub struct ActivityFilter {
    // ... existing
    pub min_amount: Option<String>,  // NEW
}
```

3. Build filter in handler:
```rust
let filter = ActivityFilter {
    // ... existing
    min_amount: params.min_amount,  // NEW
};
```

4. Apply in repository:
```rust
if let Some(ref min_amount) = filter.min_amount {
    query.push(" AND amount >= ");
    query.push_bind(min_amount);
}
```

5. Add tests:
```rust
#[tokio::test]
async fn test_filter_by_min_amount() {
    // Insert test data with various amounts
    // Query with min_amount filter
    // Assert correct filtering
}
```

### Adding New Query Endpoints

**Example: Add aggregation endpoint**

1. Create new handler:
```rust
// src/api/aggregations.rs
pub async fn daily_summary_handler(
    State(db): State<PgPool>,
    Path(account_id): Path<String>,
) -> Result<Json<DailySummaryResponse>> { ... }
```

2. Register route in main.rs:
```rust
.route(
    "/api/v1/accounts/:account_id/summary/daily",
    get(aggregations::daily_summary_handler),
)
```

3. Add repository function:
```rust
// src/repositories/aggregations.rs
pub async fn get_daily_summary(
    db: &PgPool,
    account_id: &str,
    date: DateTime<Utc>,
) -> Result<DailySummary> { ... }
```

## Performance Tuning

### Query Optimization

**High-latency query detection:**
- Monitor query times via application metrics
- Flag queries taking >100ms for analysis
- Common causes: missing filters, deep pagination, large result sets

**Index usage verification:**
```sql
-- Check if index is being used
EXPLAIN ANALYZE
SELECT * FROM account_activity
WHERE account_id = 'GABC...' 
ORDER BY created_at DESC LIMIT 20;
```

### Connection Pooling

```rust
PgPoolOptions::new()
    .max_connections(10)  // Adjust based on load
    .acquire_timeout(Duration::from_secs(5))
    .connect(&database_url)
    .await?
```

### Database Timeout

```rust
// Statement timeout (per query)
connect_options.options([("statement_timeout", "5000ms")])

// This prevents runaway queries from blocking connections
```

## Deployment Considerations

### Environment Variables

```bash
DATABASE_URL=postgresql://...
TEST_DATABASE_URL=postgresql://...
DB_TIMEOUT_SEC=5
PROMETHEUS_PORT=9090
RUST_LOG=info,ancore_indexer=debug
```

### Health Checks

The `/health` endpoint exposes:
- Indexer lag (blocks and estimated seconds)
- Database connectivity
- Service availability

Use for:
- Load balancer health checks
- Monitoring dashboards
- Alerts (lag > threshold)

### Metrics

Prometheus metrics available at `/metrics/prometheus`:
- `indexer_lag_blocks`: Blocks behind chain head
- `indexer_lag_seconds`: Estimated seconds behind

## Changelog

### v1.0

- Cursor-based pagination with composite keyset
- Flexible filtering (type, asset, counterparty, ledger, date)
- Account-scoped security model
- Comprehensive error handling and validation
- Database indexes for performance
- Test coverage for pagination and filtering
