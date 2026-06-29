# Indexer Query API — Quick Start Guide

## 30-Second Overview

The Ancore Indexer provides independent query endpoints for account activity with cursor-based pagination and flexible filtering. Start querying in seconds.

```bash
# Get recent activity
curl http://localhost:8000/api/v1/accounts/GABC.../activity

# Filter by type
curl http://localhost:8000/api/v1/accounts/GABC.../activity?activity_type=payment

# Paginate
curl http://localhost:8000/api/v1/accounts/GABC.../activity?limit=20&cursor_after=...
```

---

## Setup (5 minutes)

### 1. Start the Indexer

```bash
cd services/indexer
export DATABASE_URL=postgresql://user:pass@localhost/ancore
cargo run
```

Server runs on `http://localhost:8000`

### 2. Verify Health

```bash
curl http://localhost:8000/health
```

Response:

```json
{
  "status": "healthy",
  "indexer_lag_blocks": 42,
  "indexer_lag_seconds": 210
}
```

### 3. Query Activity

```bash
curl "http://localhost:8000/api/v1/accounts/GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890/activity"
```

---

## Basic Usage

### List Recent Activity

```bash
# Get 20 most recent activities
curl "http://localhost:8000/api/v1/accounts/{account_id}/activity"
```

### Filter by Type

```bash
# Get payments only
curl "http://localhost:8000/api/v1/accounts/{account_id}/activity?activity_type=payment"
```

### Date Range Query

```bash
# Activities in January 2024
curl "http://localhost:8000/api/v1/accounts/{account_id}/activity?from_date=2024-01-01T00:00:00Z&to_date=2024-01-31T23:59:59Z"
```

### Combine Filters

```bash
# Payments made between specific ledgers
curl "http://localhost:8000/api/v1/accounts/{account_id}/activity?activity_type=payment&ledger_min=1000&ledger_max=2000"
```

---

## Pagination

### Get First Page

```bash
curl "http://localhost:8000/api/v1/accounts/{account_id}/activity?limit=20"
```

Response includes:

```json
{
  "data": [...],
  "pagination": {
    "has_next_page": true,
    "next_cursor": "eyJ0IjoiMjAyNC0wMS0xNVQxMDozMDowMFoiLCJpIjoiNTUwZTg0MDAta2V5In0="
  }
}
```

### Get Next Page

```bash
# Use next_cursor from previous response
curl "http://localhost:8000/api/v1/accounts/{account_id}/activity?limit=20&cursor_after=eyJ0IjoiMjAyNC0wMS0xNVQxMDozMDowMFoiLCJpIjoiNTUwZTg0MDAta2V5In0="
```

### Simple Pagination Loop (JavaScript)

```javascript
async function fetchAll(accountId) {
  let cursor = null;
  const allRecords = [];

  while (true) {
    const url = new URL(`/api/v1/accounts/${accountId}/activity`, 'http://localhost:8000');
    url.searchParams.set('limit', '50');
    if (cursor) {
      url.searchParams.set('cursor_after', cursor);
    }

    const response = await fetch(url);
    const json = await response.json();

    allRecords.push(...json.data);

    if (!json.pagination.has_next_page) {
      break;
    }

    cursor = json.pagination.next_cursor;
  }

  return allRecords;
}
```

---

## Common Operations

### Get Single Activity

```bash
curl "http://localhost:8000/api/v1/accounts/{account_id}/activity/{activity_id}"
```

### List Available Types

```bash
curl "http://localhost:8000/api/v1/accounts/{account_id}/activity/types"
```

Response:

```json
{
  "data": ["payment", "transfer", "session_key_added", "relay_executed"]
}
```

---

## Query Parameters Reference

| Parameter       | Type     | Example                           | Required                 |
| --------------- | -------- | --------------------------------- | ------------------------ |
| `limit`         | int      | `?limit=20`                       | No (default 20, max 100) |
| `cursor_after`  | string   | `?cursor_after=...`               | No                       |
| `cursor_before` | string   | `?cursor_before=...`              | No                       |
| `activity_type` | string   | `?activity_type=payment`          | No                       |
| `asset`         | string   | `?asset=native`                   | No                       |
| `counterparty`  | string   | `?counterparty=GXYZ...`           | No                       |
| `ledger_min`    | int      | `?ledger_min=1000`                | No                       |
| `ledger_max`    | int      | `?ledger_max=2000`                | No                       |
| `from_date`     | ISO 8601 | `?from_date=2024-01-01T00:00:00Z` | No                       |
| `to_date`       | ISO 8601 | `?to_date=2024-01-31T23:59:59Z`   | No                       |

---

## Error Handling

### Errors Have Codes

All errors return a code you can handle:

```json
{
  "code": "INVALID_FILTER",
  "message": "ledger_min must be <= ledger_max"
}
```

### Common Error Codes

| Code             | Cause                     | HTTP Status |
| ---------------- | ------------------------- | ----------- |
| `INVALID_FILTER` | Bad parameter value       | 400         |
| `INVALID_CURSOR` | Invalid cursor format     | 400         |
| `NOT_FOUND`      | Record doesn't exist      | 404         |
| `QUERY_TIMEOUT`  | Query took too long       | 504         |
| `DATABASE_ERROR` | Database connection issue | 500         |

### Error Handling (JavaScript)

```javascript
async function fetchActivity(accountId) {
  const response = await fetch(`http://localhost:8000/api/v1/accounts/${accountId}/activity`);

  if (!response.ok) {
    const error = await response.json();

    if (error.code === 'INVALID_FILTER') {
      console.error(`Validation error: ${error.message}`);
    } else if (error.code === 'QUERY_TIMEOUT') {
      console.error('Query timed out. Try narrower filters.');
    } else {
      console.error(`Error: ${error.message}`);
    }

    return null;
  }

  return response.json();
}
```

---

## Response Schema

### Success Response

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "account_id": "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
      "activity_type": "payment",
      "amount": "100.0000000",
      "asset": "native",
      "asset_code": "XLM",
      "asset_issuer": null,
      "counterparty": "GXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890AB",
      "tx_hash": "abc123...",
      "ledger_seq": 47290343,
      "created_at": "2024-01-15T10:30:00Z",
      "metadata": {}
    }
  ],
  "pagination": {
    "has_next_page": true,
    "has_previous_page": false,
    "next_cursor": "eyJ0IjoiMjAyNC0wMS0xNVQxMDozMDowMFoiLCJpIjoiNTUwZTg0MDAta2V5In0=",
    "prev_cursor": null,
    "count": 1
  }
}
```

---

## Performance Tips

### ✅ Do This

```bash
# Narrow your queries
curl "http://localhost:8000/api/v1/accounts/{id}/activity?activity_type=payment&from_date=2024-01-01T00:00:00Z&to_date=2024-01-31T23:59:59Z&limit=50"

# Paginate in chunks
curl "http://localhost:8000/api/v1/accounts/{id}/activity?limit=50"
curl "http://localhost:8000/api/v1/accounts/{id}/activity?limit=50&cursor_after=..."

# Use appropriate limits
# Good: ?limit=20, ?limit=50, ?limit=100
```

### ❌ Don't Do This

```bash
# Fetch everything at once (will hit limit of 100)
curl "http://localhost:8000/api/v1/accounts/{id}/activity?limit=999"

# Query huge date ranges (might timeout)
curl "http://localhost:8000/api/v1/accounts/{id}/activity?from_date=2020-01-01T00:00:00Z&to_date=2024-12-31T23:59:59Z"

# Fetch all history repeatedly (cache/pagination instead)
```

---

## Code Examples

### Python

```python
import requests
from datetime import datetime, timedelta

def get_recent_payments(account_id: str) -> list:
    """Fetch recent payments for an account."""
    url = f"http://localhost:8000/api/v1/accounts/{account_id}/activity"
    params = {
        "activity_type": "payment",
        "limit": 50,
    }

    response = requests.get(url, params=params)
    response.raise_for_status()

    data = response.json()
    return data["data"]

# Usage
payments = get_recent_payments("GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890")
print(f"Got {len(payments)} recent payments")
```

### TypeScript

```typescript
async function getActivityByType(accountId: string, activityType: string): Promise<any[]> {
  const response = await fetch(
    `http://localhost:8000/api/v1/accounts/${accountId}/activity?activity_type=${activityType}`
  );

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const json = await response.json();
  return json.data;
}

// Usage
const transfers = await getActivityByType(accountId, 'transfer');
```

### cURL

```bash
# Get recent activity
curl "http://localhost:8000/api/v1/accounts/GABC.../activity"

# Filter and paginate
curl "http://localhost:8000/api/v1/accounts/GABC.../activity?activity_type=payment&limit=10"

# Parse with jq
curl "http://localhost:8000/api/v1/accounts/GABC.../activity" | jq '.data[] | .id'
```

---

## Debugging

### Check Service Health

```bash
curl http://localhost:8000/health
```

### View Metrics

```bash
curl http://localhost:8000/metrics/prometheus | grep indexer_lag
```

### Enable Debug Logs

```bash
RUST_LOG=debug cargo run
```

### Test Account ID Format

Valid: `GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890` (56 chars, starts with G)
Invalid: `invalid`, `GABC`, `123456`

---

## Next Steps

- **Full API docs**: See [docs/API.md](docs/API.md)
- **Usage patterns**: See [docs/USAGE_EXAMPLES.md](docs/USAGE_EXAMPLES.md)
- **Architecture**: See [docs/QUERY_ARCHITECTURE.md](docs/QUERY_ARCHITECTURE.md)
- **Implementation**: See [docs/IMPLEMENTATION_NOTES.md](docs/IMPLEMENTATION_NOTES.md)

---

## Support

**Issue?** Check the error code and message:

- `INVALID_FILTER` — Check parameter values
- `INVALID_CURSOR` — Cursor expired, start fresh pagination
- `QUERY_TIMEOUT` — Try narrower filters or smaller date range
- `NOT_FOUND` — Activity doesn't exist or wrong account

**Still stuck?** See [docs/IMPLEMENTATION_NOTES.md](docs/IMPLEMENTATION_NOTES.md) troubleshooting section.

---

## Key Concepts

### Cursor Pagination

- More efficient than offset pagination
- Handles concurrent data changes correctly
- Cursors are opaque (don't parse them)
- Cursors expire after session (don't cache them)

### Keyset Pagination

- Uses `(created_at, id)` to uniquely identify position
- Prevents duplicate/skipped records
- Constant query cost (even for deep pagination)

### Account Scoping

- All queries return only your account's data
- Different accounts are completely isolated
- You cannot see other accounts' activity

---

## Version Info

- **API Version**: 1.0
- **Implementation**: Production-ready
- **Last Updated**: June 27, 2026
