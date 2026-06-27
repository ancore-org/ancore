# Query API Usage Examples

## Quick Start

### List Recent Activity

Get the 20 most recent activities for an account:

```bash
curl -X GET "http://localhost:8000/api/v1/accounts/GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890/activity"
```

Response:
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
      "tx_hash": "abc123def456...",
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

## JavaScript/TypeScript Examples

### Example 1: Fetch All Records with Pagination

```typescript
async function fetchAllActivity(accountId: string): Promise<ActivityRecord[]> {
  const allRecords: ActivityRecord[] = [];
  let cursor: string | undefined;

  while (true) {
    const params = new URLSearchParams({ limit: "50" });
    if (cursor) {
      params.append("cursor_after", cursor);
    }

    const response = await fetch(
      `http://localhost:8000/api/v1/accounts/${accountId}/activity?${params}`
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

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

### Example 2: Filter Recent Payments

```typescript
async function getRecentPayments(
  accountId: string,
  limit: number = 20
): Promise<ActivityRecord[]> {
  const params = new URLSearchParams({
    activity_type: "payment",
    limit: String(limit),
  });

  const response = await fetch(
    `http://localhost:8000/api/v1/accounts/${accountId}/activity?${params}`
  );

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const json = await response.json();
  return json.data;
}
```

### Example 3: Query with Date Range

```typescript
async function getActivityInDateRange(
  accountId: string,
  fromDate: Date,
  toDate: Date
): Promise<ActivityRecord[]> {
  const params = new URLSearchParams({
    from_date: fromDate.toISOString(),
    to_date: toDate.toISOString(),
    limit: "100",
  });

  const response = await fetch(
    `http://localhost:8000/api/v1/accounts/${accountId}/activity?${params}`
  );

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const json = await response.json();
  return json.data;
}
```

### Example 4: "Load More" Infinite Scroll Pattern

```typescript
class ActivityFeed {
  private accountId: string;
  private currentCursor: string | null = null;
  private hasMore: boolean = true;

  constructor(accountId: string) {
    this.accountId = accountId;
  }

  async loadMore(limit: number = 20): Promise<ActivityRecord[]> {
    if (!this.hasMore) {
      return [];
    }

    const params = new URLSearchParams({ limit: String(limit) });
    if (this.currentCursor) {
      params.append("cursor_after", this.currentCursor);
    }

    const response = await fetch(
      `http://localhost:8000/api/v1/accounts/${this.accountId}/activity?${params}`
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const json = await response.json();

    this.currentCursor = json.pagination.next_cursor;
    this.hasMore = json.pagination.has_next_page;

    return json.data;
  }

  reset(): void {
    this.currentCursor = null;
    this.hasMore = true;
  }
}

// Usage
const feed = new ActivityFeed(accountId);

// Initial load
const initialBatch = await feed.loadMore(20);
renderRecords(initialBatch);

// User scrolls to bottom
const nextBatch = await feed.loadMore(20);
renderRecords(nextBatch);

// Reset to reload from top
feed.reset();
const freshBatch = await feed.loadMore(20);
renderRecords(freshBatch);
```

### Example 5: Query Activity Types

```typescript
async function getActivityTypes(accountId: string): Promise<string[]> {
  const response = await fetch(
    `http://localhost:8000/api/v1/accounts/${accountId}/activity/types`
  );

  if (!response.ok) {
    if (response.status === 404) {
      return []; // No activity for this account
    }
    throw new Error(`API error: ${response.statusText}`);
  }

  const json = await response.json();
  return json.data;
}
```

### Example 6: Get Single Activity Record

```typescript
async function getActivityById(
  accountId: string,
  activityId: string
): Promise<ActivityRecord | null> {
  const response = await fetch(
    `http://localhost:8000/api/v1/accounts/${accountId}/activity/${activityId}`
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const json = await response.json();
  return json.data;
}
```

## Python Examples

### Example 1: Basic Query with Requests

```python
import requests
from datetime import datetime, timedelta

def get_recent_activity(account_id: str, limit: int = 20) -> list:
    """Fetch recent activity for an account."""
    url = f"http://localhost:8000/api/v1/accounts/{account_id}/activity"
    params = {
        "limit": limit,
    }
    
    response = requests.get(url, params=params)
    response.raise_for_status()
    
    data = response.json()
    return data["data"]


def get_payments_by_asset(account_id: str, asset: str) -> list:
    """Fetch all payment activity for a specific asset."""
    url = f"http://localhost:8000/api/v1/accounts/{account_id}/activity"
    
    all_records = []
    cursor = None
    
    while True:
        params = {
            "activity_type": "payment",
            "asset": asset,
            "limit": 100,
        }
        if cursor:
            params["cursor_after"] = cursor
        
        response = requests.get(url, params=params)
        response.raise_for_status()
        
        data = response.json()
        all_records.extend(data["data"])
        
        if not data["pagination"]["has_next_page"]:
            break
        
        cursor = data["pagination"]["next_cursor"]
    
    return all_records
```

### Example 2: Date Range Query with Retry Logic

```python
import requests
import time
from datetime import datetime, timedelta
from typing import List, Optional

class ActivityClient:
    def __init__(self, base_url: str = "http://localhost:8000", max_retries: int = 3):
        self.base_url = base_url
        self.max_retries = max_retries
    
    def query_date_range(
        self,
        account_id: str,
        from_date: datetime,
        to_date: datetime,
        activity_type: Optional[str] = None,
    ) -> List[dict]:
        """Query activity within a date range with retry logic."""
        all_records = []
        cursor = None
        
        while True:
            params = {
                "from_date": from_date.isoformat(),
                "to_date": to_date.isoformat(),
                "limit": 100,
            }
            
            if activity_type:
                params["activity_type"] = activity_type
            
            if cursor:
                params["cursor_after"] = cursor
            
            # Retry logic
            for attempt in range(self.max_retries):
                try:
                    response = requests.get(
                        f"{self.base_url}/api/v1/accounts/{account_id}/activity",
                        params=params,
                        timeout=10,
                    )
                    response.raise_for_status()
                    break
                except requests.exceptions.Timeout:
                    if attempt == self.max_retries - 1:
                        raise
                    wait_time = 2 ** attempt  # exponential backoff
                    print(f"Timeout, retrying in {wait_time}s...")
                    time.sleep(wait_time)
            
            data = response.json()
            all_records.extend(data["data"])
            
            if not data["pagination"]["has_next_page"]:
                break
            
            cursor = data["pagination"]["next_cursor"]
        
        return all_records


# Usage
client = ActivityClient()

# Get all payments from January
payments = client.query_date_range(
    account_id="GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
    from_date=datetime(2024, 1, 1),
    to_date=datetime(2024, 1, 31, 23, 59, 59),
    activity_type="payment",
)

print(f"Found {len(payments)} payments in January")
```

## Error Handling Examples

### Example 1: Handle Invalid Cursor

```typescript
async function handleInvalidCursor(
  accountId: string,
  invalidCursor: string
): Promise<void> {
  const params = new URLSearchParams({
    cursor_after: invalidCursor,
  });

  const response = await fetch(
    `http://localhost:8000/api/v1/accounts/${accountId}/activity?${params}`
  );

  if (response.status === 400) {
    const error = await response.json();
    
    if (error.code === "INVALID_CURSOR") {
      console.error("Cursor expired or invalid. Starting from beginning.");
      // Retry without cursor to get fresh pagination state
      const freshResponse = await fetch(
        `http://localhost:8000/api/v1/accounts/${accountId}/activity`
      );
      // ... handle fresh response
    }
  }
}
```

### Example 2: Handle Validation Errors

```typescript
async function validateAndQuery(
  accountId: string,
  filters: ActivityFilters
): Promise<ActivityRecord[]> {
  const params = new URLSearchParams();

  // Add filters only if provided
  if (filters.activity_type) {
    params.append("activity_type", filters.activity_type);
  }
  if (filters.asset) {
    params.append("asset", filters.asset);
  }
  if (filters.ledger_min !== undefined) {
    params.append("ledger_min", String(filters.ledger_min));
  }
  if (filters.ledger_max !== undefined) {
    params.append("ledger_max", String(filters.ledger_max));
  }

  const response = await fetch(
    `http://localhost:8000/api/v1/accounts/${accountId}/activity?${params}`
  );

  if (response.status === 400) {
    const error = await response.json();

    if (error.code === "INVALID_FILTER") {
      // Common validation errors:
      if (error.message.includes("account_id")) {
        throw new Error("Invalid account ID format");
      }
      if (error.message.includes("ledger_min")) {
        throw new Error("ledger_min must be less than or equal to ledger_max");
      }
      if (error.message.includes("from_date")) {
        throw new Error("from_date must be less than or equal to to_date");
      }

      throw new Error(`Validation error: ${error.message}`);
    }
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const json = await response.json();
  return json.data;
}
```

### Example 3: Handle Timeouts

```typescript
async function queryWithTimeout(
  accountId: string,
  filters: any,
  timeoutMs: number = 30000
): Promise<ActivityRecord[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const params = new URLSearchParams(filters);
    const response = await fetch(
      `http://localhost:8000/api/v1/accounts/${accountId}/activity?${params}`,
      { signal: controller.signal }
    );

    if (response.status === 504) {
      const error = await response.json();
      if (error.code === "QUERY_TIMEOUT") {
        throw new Error(
          "Query took too long. Try narrowing your date range or filters."
        );
      }
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

## Performance Tips

### Tip 1: Use Appropriate Limits

```typescript
// ❌ Don't fetch everything at once
async function slowApproach(accountId: string) {
  const response = await fetch(
    `http://localhost:8000/api/v1/accounts/${accountId}/activity?limit=1000`
  );
  // This will fail - limit is clamped to 100 and might timeout
}

// ✅ Paginate in reasonable chunks
async function fastApproach(accountId: string) {
  const allRecords: ActivityRecord[] = [];
  let cursor: string | undefined;

  while (true) {
    const params = new URLSearchParams({ limit: "50" }); // reasonable chunk
    if (cursor) {
      params.append("cursor_after", cursor);
    }

    const response = await fetch(
      `http://localhost:8000/api/v1/accounts/${accountId}/activity?${params}`
    );

    const json = await response.json();
    allRecords.push(...json.data);

    if (!json.pagination.has_next_page) break;
    cursor = json.pagination.next_cursor;
  }

  return allRecords;
}
```

### Tip 2: Filter Early

```typescript
// ❌ Fetch all, then filter in app
async function slowFilter(accountId: string) {
  let allRecords: ActivityRecord[] = [];
  let cursor: string | undefined;

  while (true) {
    const response = await fetch(
      `http://localhost:8000/api/v1/accounts/${accountId}/activity?limit=100`
    );
    const json = await response.json();
    allRecords.push(...json.data);

    if (!json.pagination.has_next_page) break;
    cursor = json.pagination.next_cursor;
  }

  // Filter after fetching everything
  return allRecords.filter((r) => r.activity_type === "payment");
}

// ✅ Filter in query
async function fastFilter(accountId: string) {
  const params = new URLSearchParams({
    activity_type: "payment",
    limit: "100",
  });

  const response = await fetch(
    `http://localhost:8000/api/v1/accounts/${accountId}/activity?${params}`
  );

  const json = await response.json();
  return json.data;
}
```

### Tip 3: Use Date Ranges for Large Datasets

```typescript
// ❌ Query entire year - might timeout
const year2024 = await queryActivity(accountId, {
  from_date: "2024-01-01T00:00:00Z",
  to_date: "2024-12-31T23:59:59Z",
});

// ✅ Query month by month
async function getYear(accountId: string, year: number) {
  const allRecords: ActivityRecord[] = [];

  for (let month = 1; month <= 12; month++) {
    const from = new Date(year, month - 1, 1).toISOString();
    const to = new Date(year, month, 0, 23, 59, 59).toISOString();

    const response = await fetch(
      `http://localhost:8000/api/v1/accounts/${accountId}/activity?from_date=${from}&to_date=${to}&limit=100`
    );

    const json = await response.json();
    allRecords.push(...json.data);
  }

  return allRecords;
}
```

## Testing Examples

### Unit Test: Pagination Logic

```typescript
import { describe, it, expect } from "vitest";

describe("Pagination", () => {
  it("should request next page using cursor", async () => {
    // Mock first page
    const firstPageCursor = "eyJ0IjoiMjAyNC0wMS0xNVQxMDozMDowMFoiLCJpIjoiNTUwZTg0MDAta2V5In0=";

    const firstResponse = {
      data: [{ id: "1" }, { id: "2" }],
      pagination: {
        has_next_page: true,
        next_cursor: firstPageCursor,
      },
    };

    // Mock second page
    const secondResponse = {
      data: [{ id: "3" }, { id: "4" }],
      pagination: {
        has_next_page: false,
        next_cursor: null,
      },
    };

    // Verify cursor is passed to next request
    expect(firstResponse.pagination.has_next_page).toBe(true);
    expect(firstResponse.pagination.next_cursor).toBeDefined();
  });
});
```

## Curl Examples

### List activity with filters

```bash
curl -X GET \
  "http://localhost:8000/api/v1/accounts/GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890/activity?activity_type=payment&limit=10&ledger_min=47290000&ledger_max=47300000"
```

### Get single activity

```bash
curl -X GET \
  "http://localhost:8000/api/v1/accounts/GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890/activity/550e8400-e29b-41d4-a716-446655440000"
```

### Get activity types

```bash
curl -X GET \
  "http://localhost:8000/api/v1/accounts/GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890/activity/types"
```

### Paginate with cursor

```bash
# First page
RESPONSE=$(curl -s -X GET \
  "http://localhost:8000/api/v1/accounts/GABC.../activity?limit=10")

# Extract next cursor
NEXT_CURSOR=$(echo $RESPONSE | jq -r '.pagination.next_cursor')

# Second page
curl -X GET \
  "http://localhost:8000/api/v1/accounts/GABC.../activity?limit=10&cursor_after=$NEXT_CURSOR"
```
