use axum::{extract::State, response::Json};
use chrono::Utc;
use serde::Serialize;
use sqlx::{PgPool, Row};

use crate::error::Result;
use crate::metrics::record_lag;

/// Health response body.
///
/// Reports the latest ledger the indexer has processed, the current chain
/// head (latest ledger on the network), the block-level lag between them,
/// an estimated lag in seconds derived from the Stellar ledger close time
/// of roughly 5 seconds per ledger, and the state of schema migrations so
/// deploys can be verified against the expected schema version.
#[derive(Debug, Serialize)]
pub struct HealthResponse {
    /// ISO-8601 timestamp of when this response was generated.
    pub timestamp: String,
    /// Status: "ok" when lag is within acceptable range and no known
    /// migration is pending, "degraded" otherwise.
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
    /// Highest applied migration version from the schema_migrations table,
    /// or null when the tracking table does not exist yet (pre-005 database).
    pub schema_version: Option<String>,
    /// Number of migrations recorded in schema_migrations, or null when the
    /// tracking table does not exist yet.
    pub migrations_applied: Option<i64>,
    /// Number of known migrations not yet recorded as applied, or null when
    /// the tracking table does not exist yet.
    pub migrations_pending: Option<i64>,
}

/// Approximate Stellar ledger close time used for lag estimation.
const STELLAR_LEDGER_CLOSE_SECONDS: i64 = 5;

/// Lag threshold above which the service is considered "degraded".
const DEGRADED_LAG_BLOCKS: i64 = 100;

/// Migration versions known to this build, in apply order. Keep in sync with
/// the numeric prefixes of the files in services/indexer/migrations/.
const KNOWN_MIGRATIONS: [&str; 5] = ["001", "002", "003", "004", "005"];

/// Known migrations missing from the applied set, in apply order.
fn pending_migrations<'a>(expected: &[&'a str], applied: &[String]) -> Vec<&'a str> {
    expected
        .iter()
        .copied()
        .filter(|v| !applied.iter().any(|a| a == v))
        .collect()
}

/// GET /health
///
/// Returns indexer lag metrics derived from the activity_records table plus
/// schema migration status read from the schema_migrations table.
/// In production, `chain_head` should be fetched from a live Horizon or
/// Stellar RPC endpoint; here we use the MAX(ledger_seq) in the DB as a
/// stand-in so the endpoint is fully self-contained.
pub async fn health_handler(State(db): State<PgPool>) -> Result<Json<HealthResponse>> {
    // Latest ledger the indexer has indexed (most-recent record persisted).
    let indexed_row =
        sqlx::query("SELECT COALESCE(MAX(ledger_seq), 0) AS latest FROM activity_records")
            .fetch_one(&db)
            .await?;

    let latest_indexed_ledger: i64 = indexed_row.try_get("latest")?;

    // Chain head proxy: in production replace with a Horizon /ledgers call.
    // For now we treat the highest ledger we have ever seen as the chain head
    // (same value, so lag is always 0 unless the indexer has genuinely fallen
    // behind a separately-maintained chain-head counter).
    let chain_head_row =
        sqlx::query("SELECT COALESCE(MAX(ledger_seq), 0) AS head FROM activity_records")
            .fetch_one(&db)
            .await?;

    let chain_head: i64 = chain_head_row.try_get("head")?;

    let lag_blocks = (chain_head - latest_indexed_ledger).max(0);
    let lag_seconds = lag_blocks * STELLAR_LEDGER_CLOSE_SECONDS;

    // Migration status. The tracking table only exists once migration 005 has
    // run, so a missing table is reported as null fields instead of an error.
    let migration_rows = sqlx::query("SELECT version FROM schema_migrations")
        .fetch_all(&db)
        .await;

    let (schema_version, migrations_applied, migrations_pending) = match migration_rows {
        Ok(rows) => {
            let applied: Vec<String> = rows
                .iter()
                .map(|r| r.try_get::<String, _>("version"))
                .collect::<std::result::Result<_, _>>()?;
            let latest = applied.iter().max().cloned();
            let pending = pending_migrations(&KNOWN_MIGRATIONS, &applied);
            (
                latest,
                Some(applied.len() as i64),
                Some(pending.len() as i64),
            )
        }
        Err(_) => (None, None, None),
    };

    let degraded =
        lag_blocks >= DEGRADED_LAG_BLOCKS || migrations_pending.map(|p| p > 0).unwrap_or(true);

    let status = if degraded {
        "degraded".to_string()
    } else {
        "ok".to_string()
    };

    // Update Prometheus metrics
    record_lag(lag_blocks, lag_seconds);

    Ok(Json(HealthResponse {
        timestamp: Utc::now().to_rfc3339(),
        status,
        latest_indexed_ledger,
        chain_head,
        lag_blocks,
        lag_seconds,
        schema_version,
        migrations_applied,
        migrations_pending,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn applied(versions: &[&str]) -> Vec<String> {
        versions.iter().map(|v| v.to_string()).collect()
    }

    #[test]
    fn pending_empty_when_all_known_migrations_applied() {
        let pending = pending_migrations(&KNOWN_MIGRATIONS, &applied(&KNOWN_MIGRATIONS));
        assert!(pending.is_empty());
    }

    #[test]
    fn pending_lists_missing_migrations_in_order() {
        let pending = pending_migrations(&KNOWN_MIGRATIONS, &applied(&["001", "002", "004"]));
        assert_eq!(pending, vec!["003", "005"]);
    }

    #[test]
    fn pending_ignores_rows_newer_than_this_build() {
        let mut applied = applied(&KNOWN_MIGRATIONS);
        applied.push("006".to_string());
        let pending = pending_migrations(&KNOWN_MIGRATIONS, &applied);
        assert!(pending.is_empty());
    }

    #[test]
    fn pending_full_when_table_empty() {
        let pending = pending_migrations(&KNOWN_MIGRATIONS, &[]);
        assert_eq!(pending.len(), KNOWN_MIGRATIONS.len());
    }
}
