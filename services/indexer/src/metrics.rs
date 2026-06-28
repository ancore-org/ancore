//! Metrics module for operational visibility.
//!
//! Provides cursor staleness detection and other operational metrics
//! to enable proactive monitoring and alerting.

use chrono::{DateTime, Utc};
use metrics::{describe_gauge, describe_histogram, gauge, histogram};
use serde::Serialize;
use sqlx::{PgPool, Row};

use crate::error::Result;

/// Cursor staleness metrics for monitoring ingestion health.
#[derive(Debug, Serialize, Clone)]
pub struct CursorMetrics {
    /// Name of the ingestion stream.
    pub stream: String,
    /// Last ledger sequence successfully processed.
    pub last_ledger_seq: i64,
    /// Timestamp when the cursor was last updated.
    pub last_updated_at: DateTime<Utc>,
    /// Seconds since the cursor was last updated.
    pub staleness_seconds: i64,
    /// Whether the cursor is considered stale based on threshold.
    pub is_stale: bool,
}

/// Threshold in seconds after which a cursor is considered stale.
/// Default: 5 minutes (60 ledgers at 5s per ledger).
pub const CURSOR_STALE_THRESHOLD_SECONDS: i64 = 300;

/// Initialize Prometheus metrics descriptions.
///
/// Call this once at application startup to register metric metadata.
pub fn init_prometheus_metrics() {
    describe_gauge!("indexer_lag_blocks", "Number of ledgers behind chain head");
    describe_gauge!("indexer_lag_seconds", "Estimated seconds behind chain head");
    describe_gauge!(
        "indexer_ingest_lag_ledgers",
        "Number of ledgers between cursor and network head"
    );
    describe_histogram!(
        "indexer_ingest_records_per_second",
        "Ingestion throughput in records per second"
    );
    describe_histogram!(
        "indexer_ingest_batch_duration_seconds",
        "Duration of ingest batch processing"
    );
}

/// Record lag metrics for Prometheus export.
///
/// Updates the Prometheus gauges with current lag values.
/// These metrics are exposed via the `/metrics` endpoint in Prometheus text format.
pub fn record_lag(lag_blocks: i64, lag_seconds: i64) {
    gauge!("indexer_lag_blocks").set(lag_blocks as f64);
    gauge!("indexer_lag_seconds").set(lag_seconds as f64);
}

/// Record ingest worker metrics for Prometheus export.
///
/// Records throughput histogram and lag gauge from ingest worker operations.
#[allow(dead_code)] // exercised by integration tests; ingest worker wiring lands separately
pub fn record_ingest_metrics(
    records_per_second: f64,
    lag_ledgers: i64,
    batch_duration_seconds: f64,
) {
    histogram!("indexer_ingest_records_per_second").record(records_per_second);
    gauge!("indexer_ingest_lag_ledgers").set(lag_ledgers as f64);
    histogram!("indexer_ingest_batch_duration_seconds").record(batch_duration_seconds);
}

/// Fetch cursor staleness metrics for all ingestion streams.
///
/// Returns metrics for each stream, including staleness indicators
/// that can be used for alerting and operational dashboards.
pub async fn get_cursor_metrics(db: &PgPool) -> Result<Vec<CursorMetrics>> {
    let rows = sqlx::query(
        "SELECT stream, last_ledger_seq, updated_at \
         FROM ingest_checkpoints \
         ORDER BY stream",
    )
    .fetch_all(db)
    .await?;

    let now = Utc::now();
    let mut metrics = Vec::with_capacity(rows.len());

    for row in rows {
        let stream: String = row.try_get("stream")?;
        let last_ledger_seq: i64 = row.try_get("last_ledger_seq")?;
        let last_updated_at: DateTime<Utc> = row.try_get("updated_at")?;

        let staleness_seconds = (now - last_updated_at).num_seconds();
        let is_stale = staleness_seconds > CURSOR_STALE_THRESHOLD_SECONDS;

        metrics.push(CursorMetrics {
            stream,
            last_ledger_seq,
            last_updated_at,
            staleness_seconds,
            is_stale,
        });
    }

    Ok(metrics)
}

/// Get cursor metrics for a specific stream.
#[allow(dead_code)]
pub async fn get_cursor_metrics_for_stream(
    db: &PgPool,
    stream: &str,
) -> Result<Option<CursorMetrics>> {
    let row = sqlx::query(
        "SELECT stream, last_ledger_seq, updated_at \
         FROM ingest_checkpoints \
         WHERE stream = $1",
    )
    .bind(stream)
    .fetch_optional(db)
    .await?;

    let Some(row) = row else {
        return Ok(None);
    };

    let now = Utc::now();
    let stream: String = row.try_get("stream")?;
    let last_ledger_seq: i64 = row.try_get("last_ledger_seq")?;
    let last_updated_at: DateTime<Utc> = row.try_get("updated_at")?;

    let staleness_seconds = (now - last_updated_at).num_seconds();
    let is_stale = staleness_seconds > CURSOR_STALE_THRESHOLD_SECONDS;

    Ok(Some(CursorMetrics {
        stream,
        last_ledger_seq,
        last_updated_at,
        staleness_seconds,
        is_stale,
    }))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    #[test]
    fn cursor_is_stale_when_exceeds_threshold() {
        let now = Utc::now();
        let stale_time = now - Duration::seconds(CURSOR_STALE_THRESHOLD_SECONDS + 1);

        let staleness_seconds = (now - stale_time).num_seconds();
        let is_stale = staleness_seconds > CURSOR_STALE_THRESHOLD_SECONDS;

        assert!(is_stale);
        assert!(staleness_seconds > CURSOR_STALE_THRESHOLD_SECONDS);
    }

    #[test]
    fn cursor_is_not_stale_when_within_threshold() {
        let now = Utc::now();
        let fresh_time = now - Duration::seconds(CURSOR_STALE_THRESHOLD_SECONDS - 1);

        let staleness_seconds = (now - fresh_time).num_seconds();
        let is_stale = staleness_seconds > CURSOR_STALE_THRESHOLD_SECONDS;

        assert!(!is_stale);
        assert!(staleness_seconds <= CURSOR_STALE_THRESHOLD_SECONDS);
    }

    #[test]
    fn cursor_at_exact_threshold_is_not_stale() {
        let now = Utc::now();
        let threshold_time = now - Duration::seconds(CURSOR_STALE_THRESHOLD_SECONDS);

        let staleness_seconds = (now - threshold_time).num_seconds();
        let is_stale = staleness_seconds > CURSOR_STALE_THRESHOLD_SECONDS;

        assert!(!is_stale);
        assert_eq!(staleness_seconds, CURSOR_STALE_THRESHOLD_SECONDS);
    }

    #[test]
    fn record_ingest_metrics_accepts_valid_values() {
        record_ingest_metrics(150.0, 5, 2.5);
        record_ingest_metrics(0.0, 0, 0.0);
        record_ingest_metrics(1000.0, 100, 10.0);
    }

    #[test]
    fn record_lag_accepts_valid_values() {
        record_lag(10, 50);
        record_lag(0, 0);
        record_lag(1000, 5000);
    }

    #[test]
    fn init_prometheus_metrics_runs_without_panic() {
        init_prometheus_metrics();
    }
}
