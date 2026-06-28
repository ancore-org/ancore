use base64::Engine as _;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::error::{ApiError, Result};

/// Page size constants
pub const DEFAULT_LIMIT: u32 = 20;
pub const MAX_LIMIT: u32 = 100;
pub const MIN_LIMIT: u32 = 1;

/// Activity record as stored in the database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityRecord {
    pub id: Uuid,
    pub account_id: String,
    pub activity_type: String,
    pub amount: Option<String>,
    pub asset: Option<String>,
    /// Alphabetic asset code: "XLM" for native, or the credit-asset code (e.g. "USDC").
    pub asset_code: Option<String>,
    /// Issuing account address; NULL for native XLM.
    pub asset_issuer: Option<String>,
    pub counterparty: Option<String>,
    pub tx_hash: String,
    pub ledger_seq: i64,
    pub created_at: DateTime<Utc>,
    pub metadata: Option<serde_json::Value>,
}

/// Split a raw asset string into `(asset_code, asset_issuer)`.
///
/// | Input            | asset_code | asset_issuer  |
/// |------------------|------------|---------------|
/// | `"native"`       | `"XLM"`    | `None`        |
/// | `"USDC:GABC..."` | `"USDC"`   | `Some("GABC...")`|
/// | `None`           | `None`     | `None`        |
#[allow(dead_code)] // exercised by integration tests; ingest wiring lands separately
pub fn normalize_asset(asset: Option<&str>) -> (Option<String>, Option<String>) {
    match asset {
        None => (None, None),
        Some("native") => (Some("XLM".to_string()), None),
        Some(s) => {
            if let Some((code, issuer)) = s.split_once(':') {
                (Some(code.to_string()), Some(issuer.to_string()))
            } else {
                (Some(s.to_string()), None)
            }
        }
    }
}

/// Parameters for inserting a new activity record.
#[derive(Debug, Clone)]
#[allow(dead_code)] // exercised by integration tests; ingest wiring lands separately
pub struct InsertActivity {
    pub account_id: String,
    pub activity_type: String,
    pub amount: Option<String>,
    pub asset: Option<String>,
    pub counterparty: Option<String>,
    pub tx_hash: String,
    pub ledger_seq: i64,
    pub created_at: DateTime<Utc>,
    pub metadata: Option<serde_json::Value>,
}

/// Insert a single activity record, deriving `asset_code`/`asset_issuer`
/// from the raw `asset` string via [`normalize_asset`].
#[allow(dead_code)] // exercised by integration tests; ingest wiring lands separately
pub async fn insert_activity(db: &PgPool, params: &InsertActivity) -> Result<Uuid> {
    let (asset_code, asset_issuer) = normalize_asset(params.asset.as_deref());

    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO account_activity \
         (id, account_id, activity_type, amount, asset, asset_code, asset_issuer, \
          counterparty, tx_hash, ledger_seq, created_at, metadata) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
    )
    .bind(id)
    .bind(&params.account_id)
    .bind(&params.activity_type)
    .bind(&params.amount)
    .bind(&params.asset)
    .bind(&asset_code)
    .bind(&asset_issuer)
    .bind(&params.counterparty)
    .bind(&params.tx_hash)
    .bind(params.ledger_seq)
    .bind(params.created_at)
    .bind(&params.metadata)
    .execute(db)
    .await?;

    Ok(id)
}

/// Filter options for activity queries
#[derive(Debug, Clone, Default)]
pub struct ActivityFilter {
    pub activity_type: Option<String>,
    pub asset: Option<String>,
    pub counterparty: Option<String>,
    pub ledger_min: Option<i64>,
    pub ledger_max: Option<i64>,
    pub from_date: Option<DateTime<Utc>>,
    pub to_date: Option<DateTime<Utc>>,
}

/// Cursor pagination parameters
#[derive(Debug, Clone, Default)]
pub struct CursorPage {
    pub after: Option<String>,
    pub before: Option<String>,
    pub limit: Option<u32>,
}

/// Paginated result
#[derive(Debug, Clone, Serialize)]
pub struct PageResult<T> {
    pub items: Vec<T>,
    pub has_next_page: bool,
    pub has_previous_page: bool,
    pub next_cursor: Option<String>,
    pub prev_cursor: Option<String>,
}

/// Decoded cursor structure
#[derive(Debug, Clone, Serialize, Deserialize)]
struct DecodedCursor {
    t: String, // ISO8601 timestamp
    i: String, // UUID as string
}

/// Encode cursor from created_at and id
fn encode_cursor(created_at: DateTime<Utc>, id: Uuid) -> String {
    let cursor = DecodedCursor {
        t: created_at.to_rfc3339(),
        i: id.to_string(),
    };
    let json = serde_json::to_string(&cursor).expect("Failed to serialize cursor");
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(json)
}

/// Decode cursor to extract created_at and id
fn decode_cursor(cursor: &str) -> Result<DecodedCursor> {
    let decoded = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(cursor)
        .map_err(|_| ApiError::InvalidCursor("Invalid base64 encoding".to_string()))?;

    let json_str = std::str::from_utf8(&decoded)
        .map_err(|_| ApiError::InvalidCursor("Invalid UTF-8".to_string()))?;

    let cursor_obj: DecodedCursor = serde_json::from_str(json_str)
        .map_err(|_| ApiError::InvalidCursor("Invalid JSON structure".to_string()))?;

    Ok(cursor_obj)
}

/// Get account activity with cursor pagination and filters
pub async fn get_account_activity(
    db: &PgPool,
    account_id: &str,
    filter: &ActivityFilter,
    page: &CursorPage,
) -> Result<PageResult<ActivityRecord>> {
    // Validate cursor parameters
    if page.after.is_some() && page.before.is_some() {
        return Err(ApiError::InvalidFilter(
            "cannot specify both cursor_after and cursor_before".to_string(),
        ));
    }

    // Validate limit
    let limit = page.limit.unwrap_or(DEFAULT_LIMIT);
    let limit = limit.clamp(MIN_LIMIT, MAX_LIMIT);
    let effective_limit = limit as i64;

    // Decode cursor if provided
    let decoded_after = if let Some(cursor) = &page.after {
        Some(decode_cursor(cursor)?)
    } else {
        None
    };

    let decoded_before = if let Some(cursor) = &page.before {
        Some(decode_cursor(cursor)?)
    } else {
        None
    };

    // Build query dynamically using QueryBuilder
    let mut query = sqlx::query_builder::QueryBuilder::new(
        "SELECT id, account_id, activity_type, amount, asset, asset_code, asset_issuer, counterparty, tx_hash, ledger_seq, created_at, metadata FROM account_activity WHERE account_id = ",
    );
    query.push_bind(account_id);

    // Apply cursor condition (keyset pagination)
    if let Some(ref decoded) = decoded_after {
        query.push(" AND (created_at, id) < (");
        query.push_bind(decoded.t.clone());
        query.push(", ");
        query.push_bind(
            Uuid::parse_str(&decoded.i)
                .map_err(|_| ApiError::InvalidCursor("Invalid UUID in cursor".to_string()))?,
        );
        query.push(")");
    } else if let Some(ref decoded) = decoded_before {
        query.push(" AND (created_at, id) > (");
        query.push_bind(decoded.t.clone());
        query.push(", ");
        query.push_bind(
            Uuid::parse_str(&decoded.i)
                .map_err(|_| ApiError::InvalidCursor("Invalid UUID in cursor".to_string()))?,
        );
        query.push(")");
    }

    // Apply filters
    if let Some(ref activity_type) = filter.activity_type {
        query.push(" AND activity_type = ");
        query.push_bind(activity_type);
    }

    if let Some(ref asset) = filter.asset {
        query.push(" AND asset = ");
        query.push_bind(asset);
    }

    if let Some(ref counterparty) = filter.counterparty {
        query.push(" AND counterparty = ");
        query.push_bind(counterparty);
    }

    if let Some(ledger_min) = filter.ledger_min {
        query.push(" AND ledger_seq >= ");
        query.push_bind(ledger_min);
    }

    if let Some(ledger_max) = filter.ledger_max {
        query.push(" AND ledger_seq <= ");
        query.push_bind(ledger_max);
    }

    if let Some(from_date) = filter.from_date {
        query.push(" AND created_at >= ");
        query.push_bind(from_date);
    }

    if let Some(to_date) = filter.to_date {
        query.push(" AND created_at <= ");
        query.push_bind(to_date);
    }

    // Order by and limit
    query.push(" ORDER BY created_at DESC, id DESC LIMIT ");
    query.push(effective_limit + 1); // Fetch one extra to detect next page

    // Build and execute query — parameters are already bound via push_bind above.
    let rows = query.build().fetch_all(db).await?;

    // Determine if there's a next page
    let has_next_page = rows.len() > effective_limit as usize;

    // Remove extra item if present
    let map_row = |row: &sqlx::postgres::PgRow| ActivityRecord {
        id: row.get("id"),
        account_id: row.get("account_id"),
        activity_type: row.get("activity_type"),
        amount: row.get("amount"),
        asset: row.get("asset"),
        asset_code: row.get("asset_code"),
        asset_issuer: row.get("asset_issuer"),
        counterparty: row.get("counterparty"),
        tx_hash: row.get("tx_hash"),
        ledger_seq: row.get("ledger_seq"),
        created_at: row.get("created_at"),
        metadata: row.get("metadata"),
    };

    let items: Vec<ActivityRecord> = if has_next_page {
        rows[..effective_limit as usize]
            .iter()
            .map(map_row)
            .collect()
    } else {
        rows.iter().map(map_row).collect()
    };

    // Generate cursors
    let next_cursor = has_next_page
        .then(|| {
            items
                .last()
                .map(|item| encode_cursor(item.created_at, item.id))
        })
        .flatten();

    let prev_cursor = decoded_after
        .is_some()
        .then(|| {
            items
                .first()
                .map(|item| encode_cursor(item.created_at, item.id))
        })
        .flatten();

    let has_previous_page = prev_cursor.is_some();

    Ok(PageResult {
        items,
        has_next_page,
        has_previous_page,
        next_cursor,
        prev_cursor,
    })
}

/// Get a single activity by ID, scoped to account_id
pub async fn get_activity_by_id(
    db: &PgPool,
    account_id: &str,
    activity_id: &Uuid,
) -> Result<Option<ActivityRecord>> {
    let row = sqlx::query(
        "SELECT id, account_id, activity_type, amount, asset, asset_code, asset_issuer, counterparty, tx_hash, ledger_seq, created_at, metadata
         FROM account_activity
         WHERE id = $1 AND account_id = $2",
    )
    .bind(activity_id)
    .bind(account_id)
    .fetch_optional(db)
    .await?;

    Ok(row.map(|r| ActivityRecord {
        id: r.get("id"),
        account_id: r.get("account_id"),
        activity_type: r.get("activity_type"),
        amount: r.get("amount"),
        asset: r.get("asset"),
        asset_code: r.get("asset_code"),
        asset_issuer: r.get("asset_issuer"),
        counterparty: r.get("counterparty"),
        tx_hash: r.get("tx_hash"),
        ledger_seq: r.get("ledger_seq"),
        created_at: r.get("created_at"),
        metadata: r.get("metadata"),
    }))
}

/// Get distinct activity types for an account
pub async fn get_activity_types(db: &PgPool, account_id: &str) -> Result<Vec<String>> {
    let rows = sqlx::query(
        "SELECT DISTINCT activity_type FROM account_activity WHERE account_id = $1 ORDER BY activity_type",
    )
    .bind(account_id)
    .fetch_all(db)
    .await?;

    let types: Vec<String> = rows.iter().map(|r| r.get("activity_type")).collect();

    if types.is_empty() {
        return Err(ApiError::NotFound);
    }

    Ok(types)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    // ── normalize_asset ───────────────────────────────────────────────────────

    #[test]
    fn normalize_asset_none_returns_none_pair() {
        assert_eq!(normalize_asset(None), (None, None));
    }

    #[test]
    fn normalize_asset_native_returns_xlm_no_issuer() {
        assert_eq!(
            normalize_asset(Some("native")),
            (Some("XLM".to_string()), None)
        );
    }

    #[test]
    fn normalize_asset_credit_splits_code_and_issuer() {
        let issuer = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";
        let asset = format!("USDC:{issuer}");
        assert_eq!(
            normalize_asset(Some(&asset)),
            (Some("USDC".to_string()), Some(issuer.to_string()))
        );
    }

    #[test]
    fn normalize_asset_bare_code_no_issuer() {
        assert_eq!(
            normalize_asset(Some("XLM")),
            (Some("XLM".to_string()), None)
        );
    }

    // ── cursor encoding ───────────────────────────────────────────────────────

    #[test]
    fn test_encode_decode_cursor_roundtrip() {
        let created_at = Utc.with_ymd_and_hms(2024, 1, 15, 10, 30, 0).unwrap();
        let id = Uuid::new_v4();

        let encoded = encode_cursor(created_at, id);
        let decoded = decode_cursor(&encoded).unwrap();

        assert_eq!(decoded.t, created_at.to_rfc3339());
        assert_eq!(decoded.i, id.to_string());
    }

    #[test]
    fn test_decode_invalid_cursor_returns_error() {
        // Malformed base64
        assert!(decode_cursor("not-valid-base64!!!").is_err());

        // Valid base64 but invalid JSON
        assert!(decode_cursor("aGVsbG8=").is_err());

        // Valid JSON but missing fields
        assert!(decode_cursor("e30=").is_err());
    }
}
