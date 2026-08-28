use axum::{extract::State, response::Json};
use chrono::Utc;
use serde::Serialize;
use sqlx::{PgPool, Row};

use crate::error::Result;
use crate::metrics::record_lag;
use crate::repositories::migrations::{
    fetch_migration_state, MigrationStatus, EXPECTED_SCHEMA_VERSION,
};

/// Health response body.
///
/// Reports the latest ledger the indexer has processed, the current chain
/// head (latest ledger on the network), the block-level lag between them,
/// an estimated lag in seconds derived from the Stellar ledger close time
/// of roughly 5 seconds per ledger, and the live database schema version so
/// deploys can verify the indexer is not serving mid-migrate.
#[derive(Debug, Serialize)]
pub struct HealthResponse {
    /// ISO-8601 timestamp of when this response was generated.
    pub timestamp: String,
    /// Status: "ok" when lag is within range and migrations are up to date,
    /// "degraded" otherwise.
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
    /// Highest migration version applied to the connected database.
    /// `null` when the `schema_migrations` ledger is missing or empty.
    pub schema_version: Option<i32>,
    /// Schema version this build of the indexer was compiled against.
    pub expected_schema_version: i32,
    /// One of `up_to_date`, `pending`, `ahead`, `unknown`.
    pub migration_status: MigrationStatus,
    /// Name of the highest applied migration, e.g. `create_contract_events_table`.
    pub latest_migration: Option<String>,
    /// ISO-8601 timestamp of when the highest migration was applied.
    pub migration_applied_at: Option<String>,
    /// Number of migrations recorded in the ledger.
    pub applied_migrations: i64,
}

/// Approximate Stellar ledger close time used for lag estimation.
const STELLAR_LEDGER_CLOSE_SECONDS: i64 = 5;

/// Lag threshold above which the service is considered "degraded".
const DEGRADED_LAG_BLOCKS: i64 = 100;

/// Decide the overall health string from lag and migration state.
///
/// A database that is behind, ahead, or has no ledger at all means the
/// indexer may be reading a schema it was not built for, so it reports
/// `degraded` regardless of how small the ledger lag is.
fn overall_status(lag_blocks: i64, migration_status: MigrationStatus) -> &'static str {
    if lag_blocks >= DEGRADED_LAG_BLOCKS || !migration_status.is_healthy() {
        "degraded"
    } else {
        "ok"
    }
}

/// GET /health
///
/// Returns indexer lag metrics derived from the account_activity table plus
/// the live database schema version read from the `schema_migrations` ledger.
/// In production, `chain_head` should be fetched from a live Horizon or
/// Stellar RPC endpoint; here we use the MAX(ledger_seq) in the DB as a
/// stand-in so the endpoint is fully self-contained.
pub async fn health_handler(State(db): State<PgPool>) -> Result<Json<HealthResponse>> {
    // Latest ledger the indexer has indexed (most-recent record persisted).
    let indexed_row =
        sqlx::query("SELECT COALESCE(MAX(ledger_seq), 0) AS latest FROM account_activity")
            .fetch_one(&db)
            .await?;

    let latest_indexed_ledger: i64 = indexed_row.try_get("latest")?;

    // Chain head proxy: in production replace with a Horizon /ledgers call.
    // For now we treat the highest ledger we have ever seen as the chain head
    // (same value, so lag is always 0 unless the indexer has genuinely fallen
    // behind a separately-maintained chain-head counter).
    let chain_head_row =
        sqlx::query("SELECT COALESCE(MAX(ledger_seq), 0) AS head FROM account_activity")
            .fetch_one(&db)
            .await?;

    let chain_head: i64 = chain_head_row.try_get("head")?;

    let lag_blocks = (chain_head - latest_indexed_ledger).max(0);
    let lag_seconds = lag_blocks * STELLAR_LEDGER_CLOSE_SECONDS;

    let migrations = fetch_migration_state(&db).await?;
    let migration_status = migrations.status();

    let status = overall_status(lag_blocks, migration_status).to_string();

    // Update Prometheus metrics
    record_lag(lag_blocks, lag_seconds);

    Ok(Json(HealthResponse {
        timestamp: Utc::now().to_rfc3339(),
        status,
        latest_indexed_ledger,
        chain_head,
        lag_blocks,
        lag_seconds,
        schema_version: migrations.schema_version,
        expected_schema_version: EXPECTED_SCHEMA_VERSION,
        migration_status,
        latest_migration: migrations.latest_migration,
        migration_applied_at: migrations.applied_at.map(|ts| ts.to_rfc3339()),
        applied_migrations: migrations.applied_count,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn healthy_when_lag_low_and_migrations_up_to_date() {
        assert_eq!(overall_status(0, MigrationStatus::UpToDate), "ok");
        assert_eq!(
            overall_status(DEGRADED_LAG_BLOCKS - 1, MigrationStatus::UpToDate),
            "ok"
        );
    }

    #[test]
    fn degraded_when_lag_exceeds_threshold() {
        assert_eq!(
            overall_status(DEGRADED_LAG_BLOCKS, MigrationStatus::UpToDate),
            "degraded"
        );
    }

    #[test]
    fn degraded_while_migrations_are_pending_even_with_no_lag() {
        assert_eq!(overall_status(0, MigrationStatus::Pending), "degraded");
    }

    #[test]
    fn degraded_when_database_is_ahead_of_this_build() {
        assert_eq!(overall_status(0, MigrationStatus::Ahead), "degraded");
    }

    #[test]
    fn degraded_when_migration_ledger_is_missing() {
        assert_eq!(overall_status(0, MigrationStatus::Unknown), "degraded");
    }
}
