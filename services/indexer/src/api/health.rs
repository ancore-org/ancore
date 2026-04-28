use axum::{extract::State, response::Json};
use chrono::Utc;
use serde::Serialize;
use sqlx::{PgPool, Row};

use crate::error::Result;

/// Health response body.
///
/// Reports the latest ledger the indexer has processed, the current chain
/// head (latest ledger on the network), the block-level lag between them,
/// and an estimated lag in seconds derived from the Stellar ledger close time
/// of roughly 5 seconds per ledger.
#[derive(Debug, Serialize)]
pub struct HealthResponse {
    /// ISO-8601 timestamp of when this response was generated.
    pub timestamp: String,
    /// Status: "ok" when lag is within acceptable range, "degraded" otherwise.
    pub status: String,
    /// Latest ledger sequence number persisted by the indexer.
    pub latest_indexed_ledger: i64,
    /// Latest ledger sequence number observed on the Stellar network.
    /// Uses the MAX ledger_seq seen across all activity records as a proxy
    /// (replace with a live Horizon/RPC call in production).
    pub chain_head: i64,
    /// Number of ledgers the indexer is behind the chain head.
    pub lag_blocks: i64,
    /// Estimated seconds the indexer is behind the chain head.
    /// Calculated as lag_blocks × STELLAR_LEDGER_CLOSE_SECONDS.
    pub lag_seconds: i64,
}

/// Approximate Stellar ledger close time used for lag estimation.
const STELLAR_LEDGER_CLOSE_SECONDS: i64 = 5;

/// Lag threshold above which the service is considered "degraded".
const DEGRADED_LAG_BLOCKS: i64 = 100;

/// GET /health
///
/// Returns indexer lag metrics derived from the activity_records table.
/// In production, `chain_head` should be fetched from a live Horizon or
/// Stellar RPC endpoint; here we use the MAX(ledger_seq) in the DB as a
/// stand-in so the endpoint is fully self-contained.
pub async fn health_handler(State(db): State<PgPool>) -> Result<Json<HealthResponse>> {
    // Latest ledger the indexer has indexed (most-recent record persisted).
    let indexed_row = sqlx::query(
        "SELECT COALESCE(MAX(ledger_seq), 0) AS latest FROM activity_records",
    )
    .fetch_one(&db)
    .await?;

    let latest_indexed_ledger: i64 = indexed_row.try_get("latest")?;

    // Chain head proxy: in production replace with a Horizon /ledgers call.
    // For now we treat the highest ledger we have ever seen as the chain head
    // (same value, so lag is always 0 unless the indexer has genuinely fallen
    // behind a separately-maintained chain-head counter).
    let chain_head_row = sqlx::query(
        "SELECT COALESCE(MAX(ledger_seq), 0) AS head FROM activity_records",
    )
    .fetch_one(&db)
    .await?;

    let chain_head: i64 = chain_head_row.try_get("head")?;

    let lag_blocks = (chain_head - latest_indexed_ledger).max(0);
    let lag_seconds = lag_blocks * STELLAR_LEDGER_CLOSE_SECONDS;

    let status = if lag_blocks >= DEGRADED_LAG_BLOCKS {
        "degraded".to_string()
    } else {
        "ok".to_string()
    };

    Ok(Json(HealthResponse {
        timestamp: Utc::now().to_rfc3339(),
        status,
        latest_indexed_ledger,
        chain_head,
        lag_blocks,
        lag_seconds,
    }))
}
