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
    /// One of `"ok"` (lag is within range and migrations are up to date),
    /// `"degraded"` (lag is too high or migrations are not healthy), or
    /// `"unknown"` (the live chain-head RPC lookup failed or
    /// `SOROBAN_RPC_URL` is unset, so lag cannot be measured).
    pub status: String,
    /// Latest ledger sequence number persisted by the indexer.
    pub latest_indexed_ledger: i64,
    /// Latest ledger sequence number observed on the Stellar network, via a
    /// live getLatestLedger Soroban RPC call. Falls back to
    /// `latest_indexed_ledger` when the RPC call fails or
    /// `SOROBAN_RPC_URL` is unset — check `rpc_unavailable` before trusting
    /// this value or the lag fields derived from it.
    pub chain_head: i64,
    /// Number of ledgers the indexer is behind the chain head.
    /// Reads 0 whenever `rpc_unavailable` is true, since `chain_head` is
    /// just `latest_indexed_ledger` in that case — not a real measurement.
    pub lag_blocks: i64,
    /// Estimated seconds the indexer is behind the chain head.
    /// Calculated as lag_blocks × STELLAR_LEDGER_CLOSE_SECONDS.
    pub lag_seconds: i64,
    /// True when `chain_head` could not be fetched from the live RPC
    /// endpoint (request failed, or `SOROBAN_RPC_URL` is unset) and fell
    /// back to `latest_indexed_ledger` instead. Callers should treat
    /// `chain_head` and `lag_blocks` as unknown, not "caught up", when this
    /// is true.
    pub rpc_unavailable: bool,
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

/// Decide the overall health string from lag, migration state, and whether
/// the live chain-head RPC lookup succeeded.
///
/// A database that is behind, ahead, or has no ledger at all means the
/// indexer may be reading a schema it was not built for, so it reports
/// `degraded` regardless of how small the ledger lag is. Likewise, when the
/// chain-head RPC call failed (or `SOROBAN_RPC_URL` is unset) `lag_blocks`
/// is not a real measurement — reporting `"ok"` in that case would hide an
/// outage behind a fake-healthy 0 lag, so it reports `"unknown"` instead.
fn overall_status(
    lag_blocks: i64,
    migration_status: MigrationStatus,
    rpc_unavailable: bool,
) -> &'static str {
    if rpc_unavailable {
        "unknown"
    } else if lag_blocks >= DEGRADED_LAG_BLOCKS || !migration_status.is_healthy() {
        "degraded"
    } else {
        "ok"
    }
}

#[derive(serde::Deserialize)]
struct GetLatestLedgerResult {
    sequence: i64,
}

#[derive(serde::Deserialize)]
struct JsonRpcResponse {
    result: Option<GetLatestLedgerResult>,
    error: Option<JsonRpcError>,
}

#[derive(serde::Deserialize)]
struct JsonRpcError {
    code: i64,
    message: String,
}

async fn fetch_chain_head_from_rpc(rpc_url: &str) -> anyhow::Result<i64> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()?;

    let request_body = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getLatestLedger"
    });

    let response = client.post(rpc_url).json(&request_body).send().await?;

    if !response.status().is_success() {
        anyhow::bail!("Stellar RPC returned HTTP status {}", response.status());
    }

    let parsed: JsonRpcResponse = response.json().await?;
    if let Some(error) = parsed.error {
        anyhow::bail!("Stellar RPC error {}: {}", error.code, error.message);
    }

    if let Some(result) = parsed.result {
        Ok(result.sequence)
    } else {
        anyhow::bail!("Stellar RPC response had neither result nor error");
    }
}

/// GET /health
///
/// Returns indexer lag metrics derived from the account_activity table plus
/// the live database schema version read from the `schema_migrations` ledger.
/// The chain_head sequence is fetched from the live network via getLatestLedger RPC.
pub async fn health_handler(State(db): State<PgPool>) -> Result<Json<HealthResponse>> {
    // Latest ledger the indexer has indexed (most-recent record persisted).
    let indexed_row =
        sqlx::query("SELECT COALESCE(MAX(ledger_seq), 0) AS latest FROM account_activity")
            .fetch_one(&db)
            .await?;

    let latest_indexed_ledger: i64 = indexed_row.try_get("latest")?;

    // Chain head: query live network chain head via getLatestLedger Soroban RPC call.
    let (chain_head, rpc_unavailable) = match std::env::var("SOROBAN_RPC_URL") {
        Ok(rpc_url) if !rpc_url.is_empty() => match fetch_chain_head_from_rpc(&rpc_url).await {
            Ok(seq) => (seq, false),
            Err(err) => {
                tracing::warn!(error = %err, "failed to fetch chain head from RPC, falling back to database max");
                (latest_indexed_ledger, true)
            }
        },
        _ => {
            tracing::warn!("SOROBAN_RPC_URL is unset, falling back to database max for chain head");
            (latest_indexed_ledger, true)
        }
    };

    let lag_blocks = (chain_head - latest_indexed_ledger).max(0);
    let lag_seconds = lag_blocks * STELLAR_LEDGER_CLOSE_SECONDS;

    let migrations = fetch_migration_state(&db).await?;
    let migration_status = migrations.status();

    let status = overall_status(lag_blocks, migration_status, rpc_unavailable).to_string();

    // Update Prometheus metrics
    record_lag(lag_blocks, lag_seconds);

    Ok(Json(HealthResponse {
        timestamp: Utc::now().to_rfc3339(),
        status,
        latest_indexed_ledger,
        chain_head,
        lag_blocks,
        lag_seconds,
        rpc_unavailable,
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
        assert_eq!(overall_status(0, MigrationStatus::UpToDate, false), "ok");
        assert_eq!(
            overall_status(DEGRADED_LAG_BLOCKS - 1, MigrationStatus::UpToDate, false),
            "ok"
        );
    }

    #[test]
    fn degraded_when_lag_exceeds_threshold() {
        assert_eq!(
            overall_status(DEGRADED_LAG_BLOCKS, MigrationStatus::UpToDate, false),
            "degraded"
        );
    }

    #[test]
    fn degraded_while_migrations_are_pending_even_with_no_lag() {
        assert_eq!(
            overall_status(0, MigrationStatus::Pending, false),
            "degraded"
        );
    }

    #[test]
    fn degraded_when_database_is_ahead_of_this_build() {
        assert_eq!(overall_status(0, MigrationStatus::Ahead, false), "degraded");
    }

    #[test]
    fn degraded_when_migration_ledger_is_missing() {
        assert_eq!(
            overall_status(0, MigrationStatus::Unknown, false),
            "degraded"
        );
    }

    #[test]
    fn unknown_when_rpc_is_unavailable_even_with_zero_lag_and_healthy_migrations() {
        // This is the regression case from #1302: when the RPC lookup
        // failed (or SOROBAN_RPC_URL is unset), chain_head falls back to
        // latest_indexed_ledger, so lag_blocks reads 0 — that must not be
        // reported as "ok" since it isn't a real measurement.
        assert_eq!(
            overall_status(0, MigrationStatus::UpToDate, true),
            "unknown"
        );
    }

    #[test]
    fn unknown_takes_priority_over_degraded_lag() {
        assert_eq!(
            overall_status(DEGRADED_LAG_BLOCKS, MigrationStatus::UpToDate, true),
            "unknown"
        );
    }

    #[test]
    fn unknown_takes_priority_over_degraded_migrations() {
        assert_eq!(overall_status(0, MigrationStatus::Pending, true), "unknown");
    }
}
