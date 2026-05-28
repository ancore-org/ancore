//! Backfill command: reprocess a specific ledger range.
//!
//! This module provides [`BackfillCommand`] which is a CLI/task entry-point
//! for reconciling historical gaps in indexed activity.  It fetches events
//! for a requested `[from_ledger, to_ledger]` range from an [`EventSource`],
//! normalises them, and persists them via an [`EventSink`].  Duplicate events
//! (already present in the sink) are expected to be handled idempotently by
//! the sink/DB layer (ON CONFLICT DO NOTHING).
//!
//! # Example (binary main)
//! ```no_run
//! use ancore_indexer::ingest::backfill::{BackfillCommand, BackfillConfig};
//! use ancore_indexer::ingest::source::VecSource;
//! use ancore_indexer::ingest::sink::MemorySink;
//!
//! # async fn run() -> anyhow::Result<()> {
//! let cmd = BackfillCommand::new(
//!     BackfillConfig { from_ledger: 100, to_ledger: 200, batch_size: 50 },
//!     VecSource::new(vec![]),
//!     MemorySink::default(),
//! );
//! let stats = cmd.run().await?;
//! println!("backfilled {} events", stats.persisted);
//! # Ok(())
//! # }
//! ```

use anyhow::Context;
use tracing::{info, warn};

use crate::schema::canonical::{normalise, CanonicalEvent};
use super::sink::EventSink;
use super::source::EventSource;

// ── Config ────────────────────────────────────────────────────────────────────

/// Configuration for a single backfill run.
#[derive(Debug, Clone)]
pub struct BackfillConfig {
    /// First ledger sequence to include (inclusive).
    pub from_ledger: u32,
    /// Last ledger sequence to include (inclusive).
    pub to_ledger: u32,
    /// Number of ledgers to request per batch from the source.
    pub batch_size: usize,
}

impl BackfillConfig {
    /// Returns `Err` if `from_ledger > to_ledger` or `batch_size == 0`.
    pub fn validate(&self) -> anyhow::Result<()> {
        anyhow::ensure!(
            self.from_ledger <= self.to_ledger,
            "from_ledger ({}) must be <= to_ledger ({})",
            self.from_ledger,
            self.to_ledger,
        );
        anyhow::ensure!(self.batch_size > 0, "batch_size must be > 0");
        Ok(())
    }
}

// ── Stats ─────────────────────────────────────────────────────────────────────

/// Cumulative statistics produced by [`BackfillCommand::run`].
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct BackfillStats {
    /// Total raw events fetched from the source.
    pub fetched: usize,
    /// Events outside the requested range that were skipped.
    pub out_of_range: usize,
    /// Events that could not be normalised (logged as warnings).
    pub errors: usize,
    /// Events successfully normalised and persisted.
    pub persisted: usize,
}

// ── Command ───────────────────────────────────────────────────────────────────

/// Backfill command that reprocesses a ledger range through source → normalise → sink.
pub struct BackfillCommand<Src, Snk> {
    config: BackfillConfig,
    source: Src,
    sink: Snk,
}

impl<Src, Snk> BackfillCommand<Src, Snk>
where
    Src: EventSource,
    Snk: EventSink,
{
    /// Create a new backfill command.
    pub fn new(config: BackfillConfig, source: Src, sink: Snk) -> Self {
        Self { config, source, sink }
    }

    /// Execute the backfill, fetching in batches from `from_ledger` to `to_ledger`.
    ///
    /// Returns [`BackfillStats`] describing the outcome.
    pub async fn run(mut self) -> anyhow::Result<BackfillStats> {
        self.config.validate()?;

        let mut stats = BackfillStats::default();
        let mut current_ledger = self.config.from_ledger.saturating_sub(1);

        info!(
            from = self.config.from_ledger,
            to = self.config.to_ledger,
            batch_size = self.config.batch_size,
            "starting backfill",
        );

        loop {
            // Stop when we have advanced past the requested range.
            if current_ledger >= self.config.to_ledger {
                break;
            }

            let raw_events = self
                .source
                .fetch(current_ledger, self.config.batch_size)
                .await
                .context("fetch events from source during backfill")?;

            if raw_events.is_empty() {
                // Source is exhausted.
                break;
            }

            let mut canonical: Vec<CanonicalEvent> = Vec::with_capacity(raw_events.len());

            for raw in raw_events {
                stats.fetched += 1;

                // Skip events outside the requested range.
                if raw.ledger_seq < self.config.from_ledger
                    || raw.ledger_seq > self.config.to_ledger
                {
                    stats.out_of_range += 1;
                    continue;
                }

                // Advance cursor for next batch request.
                if raw.ledger_seq > current_ledger {
                    current_ledger = raw.ledger_seq;
                }

                match normalise(raw) {
                    Ok(ev) => canonical.push(ev),
                    Err(e) => {
                        warn!(error = %e, "failed to normalise event during backfill, skipping");
                        stats.errors += 1;
                    }
                }
            }

            if !canonical.is_empty() {
                let count = canonical.len();
                self.sink
                    .persist(&canonical)
                    .await
                    .context("persist canonical events during backfill")?;
                stats.persisted += count;

                info!(
                    persisted = count,
                    current_ledger,
                    to = self.config.to_ledger,
                    "backfill batch committed",
                );
            }
        }

        info!(
            fetched = stats.fetched,
            persisted = stats.persisted,
            out_of_range = stats.out_of_range,
            errors = stats.errors,
            "backfill complete",
        );

        Ok(stats)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ingest::sink::MemorySink;
    use crate::ingest::source::VecSource;
    use crate::schema::canonical::RawEvent;
    use chrono::Utc;

    fn make_raw(ledger_seq: u32) -> RawEvent {
        RawEvent {
            ledger_seq,
            ledger_close_time: Utc::now(),
            tx_hash: format!("{:0>64}", ledger_seq),
            contract_id: "CTEST".to_string(),
            topics: vec!["transfer".to_string()],
            data: "{}".to_string(),
        }
    }

    #[tokio::test]
    async fn backfill_processes_events_in_range() {
        let events = vec![make_raw(100), make_raw(101), make_raw(102)];
        let cmd = BackfillCommand::new(
            BackfillConfig { from_ledger: 100, to_ledger: 102, batch_size: 10 },
            VecSource::new(events),
            MemorySink::default(),
        );
        let stats = cmd.run().await.expect("backfill should succeed");
        assert_eq!(stats.fetched, 3);
        assert_eq!(stats.persisted, 3);
        assert_eq!(stats.out_of_range, 0);
        assert_eq!(stats.errors, 0);
    }

    #[tokio::test]
    async fn backfill_skips_out_of_range_events() {
        // Events at ledger 50 and 200 are outside [100, 150]
        let events = vec![make_raw(50), make_raw(100), make_raw(150), make_raw(200)];
        let cmd = BackfillCommand::new(
            BackfillConfig { from_ledger: 100, to_ledger: 150, batch_size: 10 },
            VecSource::new(events),
            MemorySink::default(),
        );
        let stats = cmd.run().await.expect("backfill should succeed");
        assert_eq!(stats.fetched, 4);
        assert_eq!(stats.out_of_range, 2);
        assert_eq!(stats.persisted, 2);
    }

    #[tokio::test]
    async fn backfill_empty_source_returns_zero_stats() {
        let cmd = BackfillCommand::new(
            BackfillConfig { from_ledger: 1, to_ledger: 10, batch_size: 10 },
            VecSource::new(vec![]),
            MemorySink::default(),
        );
        let stats = cmd.run().await.expect("backfill should succeed");
        assert_eq!(stats.fetched, 0);
        assert_eq!(stats.persisted, 0);
    }

    #[tokio::test]
    async fn backfill_rejects_invalid_range() {
        let cmd = BackfillCommand::new(
            BackfillConfig { from_ledger: 200, to_ledger: 100, batch_size: 10 },
            VecSource::new(vec![]),
            MemorySink::default(),
        );
        let result = cmd.run().await;
        assert!(result.is_err(), "should fail with invalid range");
        assert!(result.unwrap_err().to_string().contains("from_ledger"));
    }

    #[tokio::test]
    async fn backfill_rejects_zero_batch_size() {
        let cmd = BackfillCommand::new(
            BackfillConfig { from_ledger: 1, to_ledger: 10, batch_size: 0 },
            VecSource::new(vec![]),
            MemorySink::default(),
        );
        let result = cmd.run().await;
        assert!(result.is_err());
    }
}
