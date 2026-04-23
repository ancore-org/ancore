# Ancore Indexer Service

Blockchain indexer service for the Ancore ecosystem. Provides paginated, filterable query endpoints for account activity data.

## Features

- **Cursor-based pagination**: Stable pagination that handles concurrent inserts
- **Flexible filtering**: Filter by activity type, asset, counterparty, ledger range, and date range
- **Account scoping**: All queries are scoped to a specific account for security
- **PostgreSQL backend**: Optimized with proper indexes for query performance

## API Endpoints

### List Account Activity

```
GET /api/v1/accounts/{account_id}/activity
```

Query parameters:
- `cursor_after`: Opaque cursor for forward pagination
- `cursor_before`: Opaque cursor for backward pagination
- `limit`: Page size (default: 20, max: 100, min: 1)
- `activity_type`: Filter by activity type (exact match)
- `asset`: Filter by asset code or full asset identifier
- `counterparty`: Filter by counterparty account ID
- `ledger_min`: Minimum ledger sequence (inclusive)
- `ledger_max`: Maximum ledger sequence (inclusive)
- `from_date`: ISO 8601 datetime for lower bound (inclusive)
- `to_date`: ISO 8601 datetime for upper bound (inclusive)

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "account_id": "GABC...",
      "activity_type": "payment",
      "amount": "100.0000000",
      "asset": "USDC:GABCD...",
      "counterparty": "GXYZ...",
      "tx_hash": "abc123...",
      "ledger_seq": 12345678,
      "created_at": "2024-01-15T10:30:00Z",
      "metadata": {}
    }
  ],
  "pagination": {
    "has_next_page": true,
    "has_previous_page": false,
    "next_cursor": "eyJ0IjoiMjAyNF...",
    "prev_cursor": null,
    "count": 20
  }
}
```

### Get Activity by ID

```
GET /api/v1/accounts/{account_id}/activity/{activity_id}
```

Returns a single activity record scoped to the account.

### Get Activity Types

```
GET /api/v1/accounts/{account_id}/activity/types
```

Returns distinct activity types for the account.

## Database Schema

### account_activity table

```sql
CREATE TABLE account_activity (
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

### Indexes

- `(account_id, created_at DESC)` - Primary query pattern
- `(account_id, activity_type, created_at DESC)` - Filtered queries
- `(account_id, ledger_seq DESC)` - Ledger-range queries
- `(tx_hash)` - Transaction hash lookups

## Setup

### Prerequisites

- Rust 1.74.0+
- PostgreSQL 14+

### Environment Variables

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/ancore
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/ancore_test
```

### Running Migrations

```bash
# Apply migrations
psql $DATABASE_URL -f migrations/001_create_account_activity_table.sql
```

### Development

```bash
# Install dependencies
cargo build

# Run the service
cargo run

# Run tests (requires test database)
cargo test

# Run tests with output
cargo test -- --nocapture

# Run specific test
cargo test test_encode_decode_cursor_roundtrip
```

## Architecture

### Modules

- `api/`: HTTP request handlers
- `repositories/`: Database access layer with cursor pagination
- `error.rs`: Error types and HTTP response mapping

### Cursor Pagination

Cursors are opaque base64url-encoded JSON objects containing:
- `t`: ISO 8601 timestamp
- `i`: Record UUID

This composite cursor handles ties in timestamp and ensures stable pagination under concurrent inserts.

### Security

- All queries are scoped to `account_id` - cross-account data leakage is impossible
- Cursors are opaque to clients - raw SQL values are never exposed
- Parameterized queries only - no SQL injection risk
- Input validation on all parameters

## Testing

### Unit Tests

Unit tests for cursor encoding/decoding and repository logic:

```bash
cargo test --lib
```

### Integration Tests

Integration tests require a test database:

```bash
# Set up test database
createdb ancore_test
psql ancore_test -f migrations/001_create_account_activity_table.sql

# Run integration tests
cargo test --test account_activity_api_test
```

Tests are marked with `#[ignore]` to prevent accidental execution without a test database. Remove the attribute to run them.

## License

Apache-2.0 OR MIT
