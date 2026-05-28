//! Metrics module for operational visibility.
//!
//! Provides cursor staleness detection and other operational metrics
//! to enable proactive monitoring and alerting.

use chrono::{DateTime, Duration, Utc};
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
}
