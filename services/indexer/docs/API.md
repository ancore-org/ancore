# Indexer Query API Documentation

## Overview

The Ancore Indexer provides a comprehensive REST API for querying account activity data with cursor-based pagination, flexible filtering, and account-scoped security.

**Base URL:** `/api/v1`

## API Principles

- **Account-scoped**: All queries are scoped to a specific account for security
- **Cursor-based pagination**: Stable pagination that handles concurrent inserts correctly
- **Strict filtering**: All filter parameters are optional and can be combined
- **Error envelopes**: All errors return structured error responses with machine-readable codes
- **ISO 8601 timestamps**: All timestamps use RFC 3339 format with timezone

## Authentication & Security

All endpoints require the `account_id` in the URL path, which scopes all queries to that account. The indexer enforces strict data isolation:

- A query for `account_id=A` will never return data for `account_id=B`
- Single activity record lookups verify the account ID matches before returning data
- This is enforced at the database query level, not just application logic

## Endpoints

### 1. List Account Activity

```
GET /api/v1/accounts/{account_id}/activity
```

Query the timeline of activity for an account with optional filters and pagination.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `account_id` | string | Stellar public key (56 characters, starting with 'G') |

#### Query Parameters

All query parameters are optional and can be combined.

##### Pagination Parameters

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `limit` | integer | 20 | 100 | Number of records per page. Values outside [1, 100] are clamped. |
| `cursor_after` | string | - | - | Opaque cursor for forward pagination. Fetch records after this cursor. |
| `cursor_before` | string | - | - | Opaque cursor for backward pagination. Fetch records before this cursor. |

**Note:** Specify at most one of `cursor_after` or `cursor_before`. Specifying both returns a 400 error.

##### Activity Filters

| Parameter | Type | Description |
|-----------|------|-------------|
| `activity_type` | string | Filter by activity type (e.g., "payment", "transfer", "session_key_added"). Exact match. |
| `asset` | string | Filter by asset identifier. Either "native" for XLM or "CODE:ISSUER" format. Exact match. |
| `counterparty` | string | Filter by counterparty address (recipient, revoker, etc.). Stella public key. Exact match. |
| `ledger_min` | integer | Minimum ledger sequence (inclusive). Must be ≤ `ledger_max`. |
| `ledger_max` | integer | Maximum ledger sequence (inclusive). Must be ≥ `ledger_min`. |
| `from_date` | string | ISO 8601 datetime for lower bound (inclusive). Must be ≤ `to_date`. |
| `to_date` | string | ISO 8601 datetime for upper bound (inclusive). Must be ≥ `from_date`. |

#### Response

**Status:** 200 OK

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "account_id": "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
      "activity_type": "payment",
      "amount": "100.0000000",
      "asset": "USDC:GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
      "asset_code": "USDC",
      "asset_issuer": "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
      "counterparty": "GXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890AB",
      "tx_hash": "abc123def456...",
      "ledger_seq": 47290343,
      "created_at": "2024-01-15T10:30:00Z",
      "metadata": {
        "custom_field": "value"
      }
    }
  ],
  "pagination": {
    "has_next_page": true,
    "has_previous_page": false,
    "next_cursor": "eyJ0IjoiMjAyNC0wMS0xNVQxMDozMDowMFoiLCJpIjoiNTUwZTg0MDAta2V5LWhlcmUifQ==",
    "prev_cursor": null,
    "count": 20
  }
}
```

#### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Unique identifier for this activity record |
| `account_id` | string | Stellar public key of the account |
| `activity_type` | string | Classification of the activity (e.g., "payment", "transfer", "session_key_added", "relay_executed") |
| `amount` | string or null | Transaction amount as a string to preserve precision. NULL for non-transfer activities. |
| `asset` | string or null | Raw asset identifier ("native" or "CODE:ISSUER"). NULL for non-transfer activities. |
| `asset_code` | string or null | Normalized asset code ("XLM" for native, or credit asset code like "USDC"). NULL if no asset. |
| `asset_issuer` | string or null | Stellar public key of the asset issuer. NULL for native XLM or non-transfer activities. |
| `counterparty` | string or null | The other party involved (recipient of payment, revoker of session key, etc.). NULL if not applicable. |
| `tx_hash` | string | Hexadecimal transaction hash (64 characters) |
| `ledger_seq` | integer | Ledger sequence number when the event occurred |
| `created_at` | string (ISO 8601) | RFC 3339 timestamp with timezone |
| `metadata` | object or null | Extensible JSON metadata for custom fields |

#### Error Responses

**400 Bad Request — Invalid Filter**

```json
{
  "code": "INVALID_FILTER",
  "message": "ledger_min must be <= ledger_max"
}
```

Common validation errors:
- Invalid `account_id` format (not 56-char Stellar key)
- `ledger_min > ledger_max`
- `from_date > to_date`
- Both `cursor_after` and `cursor_before` specified

**400 Bad Request — Invalid Cursor**

```json
{
  "code": "INVALID_CURSOR",
  "message": "Invalid base64 encoding"
}
```

**504 Gateway Timeout — Query Timeout**

```json
{
  "code": "QUERY_TIMEOUT",
  "message": "Database query timed out"
}
```

**500 Internal Server Error**

```json
{
  "code": "INTERNAL_ERROR",
  "message": "Internal server error"
}
```

#### Pagination Behavior

**Forward Pagination** (`cursor_after`):
1. First request: omit all cursor parameters, set `limit`
2. If `has_next_page` is true, use `next_cursor` for subsequent request
3. Continue until `has_next_page` is false

**Backward Pagination** (`cursor_before`):
1. Use `cursor_before` parameter with the cursor from `prev_cursor`
2. Results are returned in the same descending order
3. `has_previous_page` indicates if more results exist before the current batch

**Limit Clamping**:
- Limits outside [1, 100] are silently clamped
- A request with `limit=500` will return up to 100 records
- A request with `limit=0` will return 20 records (the default)

#### Examples

**List recent payments:**
```
GET /api/v1/accounts/GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890/activity?activity_type=payment&limit=10
```

**Query with date range:**
```
GET /api/v1/accounts/GABC.../activity?from_date=2024-01-01T00:00:00Z&to_date=2024-01-31T23:59:59Z
```

**Paginate large result set:**
```
# First page
GET /api/v1/accounts/GABC.../activity?limit=20

# Second page (from previous response's next_cursor)
GET /api/v1/accounts/GABC.../activity?limit=20&cursor_after=eyJ0Ijo...
```

**Complex filter:**
```
GET /api/v1/accounts/GABC.../activity?activity_type=transfer&asset=USDC:GAAZI...&ledger_min=47290000&ledger_max=47300000
```

---

### 2. Get Activity by ID

```
GET /api/v1/accounts/{account_id}/activity/{activity_id}
```

Fetch a specific activity record by its ID, scoped to the account.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `account_id` | string | Stellar public key (56 characters, starting with 'G') |
| `activity_id` | string | UUID of the activity record |

#### Response

**Status:** 200 OK

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "account_id": "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
    "activity_type": "payment",
    "amount": "100.0000000",
    "asset": "USDC:GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
    "asset_code": "USDC",
    "asset_issuer": "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
    "counterparty": "GXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890AB",
    "tx_hash": "abc123def456...",
    "ledger_seq": 47290343,
    "created_at": "2024-01-15T10:30:00Z",
    "metadata": {}
  }
}
```

#### Error Responses

**404 Not Found**

```json
{
  "code": "NOT_FOUND",
  "message": "Resource not found"
}
```

Returned when:
- The activity record doesn't exist
- The activity exists but belongs to a different account

**400 Bad Request**

```json
{
  "code": "INVALID_FILTER",
  "message": "activity_id must be a valid UUID"
}
```

#### Example

```
GET /api/v1/accounts/GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890/activity/550e8400-e29b-41d4-a716-446655440000
```

---

### 3. List Activity Types

```
GET /api/v1/accounts/{account_id}/activity/types
```

Get a list of all distinct activity types that have occurred for an account.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `account_id` | string | Stellar public key (56 characters, starting with 'G') |

#### Response

**Status:** 200 OK

```json
{
  "data": ["payment", "transfer", "session_key_added", "relay_executed"]
}
```

#### Error Responses

**404 Not Found**

```json
{
  "code": "NOT_FOUND",
  "message": "Resource not found"
}
```

Returned when the account has no activity records.

**400 Bad Request**

```json
{
  "code": "INVALID_FILTER",
  "message": "account_id must be a valid Stellar public key (56 characters starting with G)"
}
```

#### Example

```
GET /api/v1/accounts/GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890/activity/types
```

---

## Error Handling

All errors follow a consistent envelope format:

```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {}
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_CURSOR` | 400 | Cursor is malformed, expired, or invalid |
| `INVALID_FILTER` | 400 | Filter parameters are invalid or conflicting |
| `NOT_FOUND` | 404 | Resource not found or account has no activity |
| `QUERY_TIMEOUT` | 504 | Database query exceeded timeout |
| `DATABASE_ERROR` | 500 | Database connectivity or operational error |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## Pagination Guidelines

### When to Use Forward vs. Backward Pagination

- **Forward pagination** (`cursor_after`): Use for implementing "Load more" functionality
- **Backward pagination** (`cursor_before`): Use for implementing "Load newer" or bidirectional browsing

### Cursor Stability

Cursors are stable for reasonable time periods (minutes to hours). However:
- **Do not cache cursors indefinitely** — treat them as short-lived (valid for the duration of the user's session)
- **Do not persist cursors to storage** — regenerate by making a fresh query
- **Concurrent inserts** — if new records are inserted between pagination requests, they may appear multiple times across pages or be skipped. This is expected behavior for time-series data.

### Performance Tips

- **Use filters early**: Combine date/type filters with pagination for faster results
- **Appropriate limits**: Start with `limit=20` or `limit=50`; adjust based on payload size
- **Avoid large limits**: Requesting `limit=100` repeatedly may impact performance
- **Date ranges**: Narrow date ranges return faster than querying all history

## Response Pagination Info

| Field | Type | Description |
|-------|------|-------------|
| `has_next_page` | boolean | True if more records exist after the current page |
| `has_previous_page` | boolean | True if more records exist before the current page |
| `next_cursor` | string or null | Opaque cursor for fetching the next page. Null if no next page. |
| `prev_cursor` | string or null | Opaque cursor for fetching the previous page. Null if no previous page. |
| `count` | integer | Number of records in the current response |

## Rate Limiting

The API is rate-limited per source IP. Refer to the `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset` headers for current limits.

## Changelog

### Version 1.0 (Current)

- Cursor-based pagination
- Activity timeline queries
- Flexible filtering by type, asset, counterparty, ledger, and date
- Single activity lookup
- Activity type enumeration

---

## Migration from Offset-Based Pagination

If you previously used offset-based pagination:

**Old approach** (not supported):
```
GET /api/v1/accounts/.../activity?offset=20&limit=10
```

**New approach** (cursor-based):
```
# First page
GET /api/v1/accounts/.../activity?limit=10

# Next page using cursor from response
GET /api/v1/accounts/.../activity?limit=10&cursor_after=<next_cursor>
```

Benefits of cursor-based pagination:
- ✅ Handles concurrent inserts correctly
- ✅ Stable pagination (no record duplication or skipping)
- ✅ Memory-efficient (doesn't require scanning skipped records)
- ✅ Works well with large datasets

---

## Support & Feedback

For issues or feature requests, please refer to the [Ancore GitHub repository](https://github.com/stellar/ancore).
