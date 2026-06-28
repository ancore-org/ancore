use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::error::{ApiError, Result};
use crate::schema::contract_event::{ContractEvent, ContractEventFilter, InsertContractEvent};

const DEFAULT_LIMIT: u32 = 50;
const MAX_LIMIT: u32 = 200;

/// Insert a single contract event record.
pub async fn insert_contract_event(
    db: &PgPool,
    params: &InsertContractEvent,
) -> Result<Uuid> {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO contract_events \
         (id, contract_address, event_type, ledger_seq, timestamp, tx_hash, data) \
         VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(id)
    .bind(&params.contract_address)
    .bind(&params.event_type)
    .bind(params.ledger_seq)
    .bind(params.timestamp)
    .bind(&params.tx_hash)
    .bind(&params.data)
    .execute(db)
    .await?;

    Ok(id)
}

/// Query contract events with optional filters.
pub async fn get_contract_events(
    db: &PgPool,
    filter: &ContractEventFilter,
) -> Result<Vec<ContractEvent>> {
    let limit = filter
        .limit
        .unwrap_or(DEFAULT_LIMIT)
        .clamp(1, MAX_LIMIT) as i64;

    let mut query = sqlx::query_builder::QueryBuilder::new(
        "SELECT id, contract_address, event_type, ledger_seq, timestamp, tx_hash, data \
         FROM contract_events WHERE 1=1",
    );

    if let Some(ref addr) = filter.contract_address {
        query.push(" AND contract_address = ");
        query.push_bind(addr);
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
    query.push(limit);

    if let Some(offset) = filter.offset {
        query.push(" OFFSET ");
        query.push_bind(offset as i64);
    }

    let rows = query.build().fetch_all(db).await?;

    let events: Vec<ContractEvent> = rows
        .iter()
        .map(|row| ContractEvent {
            id: row.get("id"),
            contract_address: row.get("contract_address"),
            event_type: row.get("event_type"),
            ledger_seq: row.get("ledger_seq"),
            timestamp: row.get("timestamp"),
            tx_hash: row.get("tx_hash"),
            data: row.get("data"),
        })
        .collect();

    Ok(events)
}

/// Get a single contract event by ID.
pub async fn get_contract_event_by_id(
    db: &PgPool,
    event_id: &Uuid,
) -> Result<Option<ContractEvent>> {
    let row = sqlx::query(
        "SELECT id, contract_address, event_type, ledger_seq, timestamp, tx_hash, data \
         FROM contract_events WHERE id = $1",
    )
    .bind(event_id)
    .fetch_optional(db)
    .await?;

    Ok(row.map(|r| ContractEvent {
        id: r.get("id"),
        contract_address: r.get("contract_address"),
        event_type: r.get("event_type"),
        ledger_seq: r.get("ledger_seq"),
        timestamp: r.get("timestamp"),
        tx_hash: r.get("tx_hash"),
        data: r.get("data"),
    }))
}

/// Get distinct event types for a contract address.
pub async fn get_contract_event_types(
    db: &PgPool,
    contract_address: &str,
) -> Result<Vec<String>> {
    let rows = sqlx::query(
        "SELECT DISTINCT event_type FROM contract_events \
         WHERE contract_address = $1 ORDER BY event_type",
    )
    .bind(contract_address)
    .fetch_all(db)
    .await?;

    let types: Vec<String> = rows.iter().map(|r| r.get("event_type")).collect();

    if types.is_empty() {
        return Err(ApiError::NotFound);
    }

    Ok(types)
}
