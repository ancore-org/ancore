use base64::Engine as _;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::error::{ApiError, Result};
use crate::schema::contract_event::{ContractEvent, ContractEventFilter, InsertContractEvent};

/// Default page size when `limit` is omitted.
pub const DEFAULT_LIMIT: u32 = 50;
/// Minimum allowed page size (values below are clamped up).
pub const MIN_LIMIT: u32 = 1;
/// Maximum allowed page size (values above are clamped down).
pub const MAX_LIMIT: u32 = 200;

/// Paginated result for contract events.
#[derive(Debug, Clone, Serialize)]
pub struct ContractEventPageResult {
    pub items: Vec<ContractEvent>,
    pub has_next_page: bool,
    pub has_previous_page: bool,
    pub next_cursor: Option<String>,
    pub prev_cursor: Option<String>,
}

/// Decoded cursor structure for contract events.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct DecodedCursor {
    t: String,
    i: String,
}

/// Encode cursor from timestamp and id.
fn encode_cursor(timestamp: DateTime<Utc>, id: Uuid) -> String {
    let cursor = DecodedCursor {
        t: timestamp.to_rfc3339(),
        i: id.to_string(),
    };
    let json = serde_json::to_string(&cursor).expect("Failed to serialize cursor");
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(json)
}

/// Decode cursor to extract timestamp and id.
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

/// Insert a single contract event record.
///
/// Idempotent on `(tx_hash, event_type, ledger_seq)` (see migration
/// `007_add_ingest_idempotency_constraints.sql`) — re-inserting the same
/// event (a worker restart replaying already-processed ledgers, or an
/// overlapping backfill range) is a no-op rather than a duplicate row.
/// Returns `None` when the row already existed.
pub async fn insert_contract_event(
    db: &PgPool,
    params: &InsertContractEvent,
) -> Result<Option<Uuid>> {
    let id = Uuid::new_v4();
    let row = sqlx::query(
        "INSERT INTO contract_events \
         (id, contract_address, account_id, event_type, ledger_seq, timestamp, tx_hash, data) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
         ON CONFLICT (tx_hash, event_type, ledger_seq) DO NOTHING \
         RETURNING id",
    )
    .bind(id)
    .bind(&params.contract_address)
    .bind(&params.account_id)
    .bind(&params.event_type)
    .bind(params.ledger_seq)
    .bind(params.timestamp)
    .bind(&params.tx_hash)
    .bind(&params.data)
    .fetch_optional(db)
    .await?;

    Ok(row.map(|r| r.get::<Uuid, _>("id")))
}

/// Query contract events with cursor pagination and optional filters.
pub async fn get_contract_events(
    db: &PgPool,
    filter: &ContractEventFilter,
) -> Result<ContractEventPageResult> {
    if filter.cursor_after.is_some() && filter.cursor_before.is_some() {
        return Err(ApiError::InvalidFilter(
            "cannot specify both cursor_after and cursor_before".to_string(),
        ));
    }

    let limit = filter
        .limit
        .unwrap_or(DEFAULT_LIMIT)
        .clamp(MIN_LIMIT, MAX_LIMIT) as i64;

    let decoded_after = if let Some(cursor) = &filter.cursor_after {
        Some(decode_cursor(cursor)?)
    } else {
        None
    };

    let decoded_before = if let Some(cursor) = &filter.cursor_before {
        Some(decode_cursor(cursor)?)
    } else {
        None
    };

    let mut query = sqlx::query_builder::QueryBuilder::new(
        "SELECT id, contract_address, account_id, event_type, ledger_seq, timestamp, tx_hash, data \
         FROM contract_events WHERE 1=1",
    );

    if let Some(ref decoded) = decoded_after {
        query.push(" AND (timestamp, id) < (");
        query.push_bind(decoded.t.clone());
        query.push(", ");
        query.push_bind(
            Uuid::parse_str(&decoded.i)
                .map_err(|_| ApiError::InvalidCursor("Invalid UUID in cursor".to_string()))?,
        );
        query.push(")");
    } else if let Some(ref decoded) = decoded_before {
        query.push(" AND (timestamp, id) > (");
        query.push_bind(decoded.t.clone());
        query.push(", ");
        query.push_bind(
            Uuid::parse_str(&decoded.i)
                .map_err(|_| ApiError::InvalidCursor("Invalid UUID in cursor".to_string()))?,
        );
        query.push(")");
    }

    if let Some(ref addr) = filter.contract_address {
        query.push(" AND contract_address = ");
        query.push_bind(addr);
    }

    if let Some(ref account_id) = filter.account_id {
        query.push(" AND account_id = ");
        query.push_bind(account_id);
    }

    if let Some(ref event_type) = filter.event_type {
        query.push(" AND event_type = ");
        query.push_bind(event_type);
    }

    if let Some(ledger_min) = filter.ledger_min {
        query.push(" AND ledger_seq >= ");
        query.push_bind(ledger_min);
    }

    if let Some(ledger_max) = filter.ledger_max {
        query.push(" AND ledger_seq <= ");
        query.push_bind(ledger_max);
    }

    query.push(" ORDER BY timestamp DESC, id DESC LIMIT ");
    query.push(limit + 1);

    let rows = query.build().fetch_all(db).await?;

    let has_next_page = rows.len() > limit as usize;

    let map_row = |row: &sqlx::postgres::PgRow| ContractEvent {
        id: row.get("id"),
        contract_address: row.get("contract_address"),
        account_id: row.get("account_id"),
        event_type: row.get("event_type"),
        ledger_seq: row.get("ledger_seq"),
        timestamp: row.get("timestamp"),
        tx_hash: row.get("tx_hash"),
        data: row.get("data"),
    };

    let items: Vec<ContractEvent> = if has_next_page {
        rows[..limit as usize].iter().map(map_row).collect()
    } else {
        rows.iter().map(map_row).collect()
    };

    let next_cursor = has_next_page
        .then(|| {
            items
                .last()
                .map(|item| encode_cursor(item.timestamp, item.id))
        })
        .flatten();

    let prev_cursor = decoded_after
        .is_some()
        .then(|| {
            items
                .first()
                .map(|item| encode_cursor(item.timestamp, item.id))
        })
        .flatten();

    let has_previous_page = prev_cursor.is_some();

    Ok(ContractEventPageResult {
        items,
        has_next_page,
        has_previous_page,
        next_cursor,
        prev_cursor,
    })
}

/// Get a single contract event by ID.
pub async fn get_contract_event_by_id(
    db: &PgPool,
    event_id: &Uuid,
) -> Result<Option<ContractEvent>> {
    let row = sqlx::query(
        "SELECT id, contract_address, account_id, event_type, ledger_seq, timestamp, tx_hash, data \
         FROM contract_events WHERE id = $1",
    )
    .bind(event_id)
    .fetch_optional(db)
    .await?;

    Ok(row.map(|r| ContractEvent {
        id: r.get("id"),
        contract_address: r.get("contract_address"),
        account_id: r.get("account_id"),
        event_type: r.get("event_type"),
        ledger_seq: r.get("ledger_seq"),
        timestamp: r.get("timestamp"),
        tx_hash: r.get("tx_hash"),
        data: r.get("data"),
    }))
}

/// Get distinct event types for a contract address or account_id.
pub async fn get_contract_event_types(
    db: &PgPool,
    contract_address: Option<&str>,
    account_id: Option<&str>,
) -> Result<Vec<String>> {
    let mut query = sqlx::query_builder::QueryBuilder::new(
        "SELECT DISTINCT event_type FROM contract_events WHERE 1=1",
    );

    if let Some(addr) = contract_address {
        query.push(" AND contract_address = ");
        query.push_bind(addr);
    }

    if let Some(acct) = account_id {
        query.push(" AND account_id = ");
        query.push_bind(acct);
    }

    query.push(" ORDER BY event_type");

    let rows = query.build().fetch_all(db).await?;

    let types: Vec<String> = rows.iter().map(|r| r.get("event_type")).collect();

    if types.is_empty() {
        return Err(ApiError::NotFound);
    }

    Ok(types)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cursor_encode_decode_roundtrip() {
        let ts = Utc::now();
        let id = Uuid::new_v4();
        let encoded = encode_cursor(ts, id);
        let decoded = decode_cursor(&encoded).unwrap();
        assert_eq!(decoded.t, ts.to_rfc3339());
        assert_eq!(decoded.i, id.to_string());
    }

    #[test]
    fn cursor_base64url_no_padding() {
        let ts = Utc::now();
        let id = Uuid::new_v4();
        let encoded = encode_cursor(ts, id);
        assert!(!encoded.contains('+'));
        assert!(!encoded.contains('/'));
        assert!(!encoded.contains('='));
    }

    #[test]
    fn decode_invalid_cursor_returns_error() {
        assert!(decode_cursor("not-valid-base64!!!").is_err());
        assert!(decode_cursor("aGVsbG8=").is_err());
        assert!(decode_cursor("e30=").is_err());
    }

    #[test]
    fn test_limit_clamping_below_min() {
        assert_eq!(MIN_LIMIT, 1);
        let clamped = 0u32.clamp(MIN_LIMIT, MAX_LIMIT);
        assert_eq!(clamped, MIN_LIMIT);
    }

    #[test]
    fn test_limit_clamping_above_max() {
        assert_eq!(MAX_LIMIT, 200);
        let clamped = 500u32.clamp(MIN_LIMIT, MAX_LIMIT);
        assert_eq!(clamped, MAX_LIMIT);
    }

    #[test]
    fn test_limit_within_range_not_clamped() {
        let limit = 50u32;
        let clamped = limit.clamp(MIN_LIMIT, MAX_LIMIT);
        assert_eq!(clamped, 50);
    }
}
