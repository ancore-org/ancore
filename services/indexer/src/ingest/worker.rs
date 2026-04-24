//! Ingestion worker.
//!
//! [`IngestWorker`] pulls batches of [`RawEvent`]s from a source, normalises
//! them into [`CanonicalEvent`]s, persists them, and advances the checkpoint
//! cursor.  Out-of-order events (ledger_seq ≤ last checkpoint) are silently
//! skipped to guarantee idempotent restarts.

use anyhow::Context;
use tracing::{debug, info, warn};

use crate::schema::canonical::{normalise, CanonicalEvent, RawEvent};
use super::checkpoint::{Checkpoint, MemoryCheckpointStore};
use super::sink::EventSink;
use super::source::EventSource;

// ── Worker ────────────────────────────────────────────────────────────────────

/// Configuration for the ingestion worker.
#[derive(Debug, Clone)]
pub struct WorkerConfig {
    /// Logical name of this ingestion stream (used as checkpoint key).
    pub stream: String,
    /// Number of events to process per batch.
    pub batch_size: usize,
}

impl Default for WorkerConfig {
    fn default() -> Self {
        Self {
            stream: "main".into(),
            batch_size: 100,
        }
    }
}

/// Statistics collected during a single [`IngestWorker::run_once`] call.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct BatchStats {
    pub fetched: usize,
    pub skipped: usize,
    pub normalised: usize,
    pub persisted: usize,
    pub errors: usize,
}

/// The ingestion worker.
///
/// Designed to be testable without a real database: the checkpoint store,
/// event source, and event sink are all injected as trait objects.
pub struct IngestWorker<Src, Snk> {
    config: WorkerConfig,
    checkpoint: MemoryCheckpointStore,
    source: Src,
    sink: Snk,
}

impl<Src, Snk> IngestWorker<Src, Snk>
where
    Src: EventSource,
    Snk: EventSink,
{
    pub fn new(config: WorkerConfig, source: Src, sink: Snk) -> Self {
        Self {
            config,
            checkpoint: MemoryCheckpointStore::default(),
            source,
            sink,
        }
    }

    /// Seed the worker with an existing checkpoint (e.g. loaded from DB on startup).
    pub fn with_checkpoint(mut self, cp: Checkpoint) -> Self {
        self.checkpoint.save(&cp);
        self
    }

    /// Process one batch of events.
    ///
    /// Returns [`BatchStats`] describing what happened.
    pub async fn run_once(&mut self) -> anyhow::Result<BatchStats> {
        let last_seq = self
            .checkpoint
            .load(&self.config.stream)
            .map(|c| c.last_ledger_seq)
            .unwrap_or(0);

        let raw_events = self
            .source
            .fetch(last_seq, self.config.batch_size)
            .await
            .context("fetch events from source")?;

        let mut stats = BatchStats {
            fetched: raw_events.len(),
            ..Default::default()
        };

        if raw_events.is_empty() {
            debug!(stream = %self.config.stream, "no new events");
            return Ok(stats);
        }

        let mut canonical: Vec<CanonicalEvent> = Vec::with_capacity(raw_events.len());
        let mut max_ledger = last_seq;

        for raw in raw_events {
            // Skip out-of-order / already-processed events
            if raw.ledger_seq <= last_seq {
                warn!(
                    ledger_seq = raw.ledger_seq,
                    last_seq,
                    "skipping out-of-order event"
                );
                stats.skipped += 1;
                continue;
            }

            match normalise(raw) {
                Ok(ev) => {
                    max_ledger = max_ledger.max(ev.ledger_seq);
                    canonical.push(ev);
                    stats.normalised += 1;
                }
                Err(e) => {
                    warn!(error = %e, "failed to normalise event, skipping");
                    stats.errors += 1;
                }
            }
        }

        if !canonical.is_empty() {
            self.sink
                .persist(&canonical)
                .await
                .context("persist canonical events")?;
            stats.persisted = canonical.len();

            // Advance checkpoint only after successful persist
            self.checkpoint.save(&Checkpoint {
                stream: self.config.stream.clone(),
                last_ledger_seq: max_ledger,
            });

            info!(
                stream = %self.config.stream,
                persisted = stats.persisted,
                max_ledger,
                "batch committed"
            );
        }

        Ok(stats)
    }

    /// Current checkpoint (for inspection / testing).
    pub fn current_checkpoint(&self) -> Option<Checkpoint> {
        self.checkpoint.load(&self.config.stream)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ingest::sink::MemorySink;
    use crate::ingest::source::VecSource;
    use chrono::Utc;

    fn raw(ledger_seq: u32, topic: &str) -> RawEvent {
        RawEvent {
            ledger_seq,
            ledger_close_time: Utc::now(),
            tx_hash: format!("{:0>64}", ledger_seq),
            contract_id: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN".into(),
            topics: vec![topic.into()],
            data: String::new(),
        }
    }

    #[tokio::test]
    async fn processes_events_and_advances_checkpoint() {
        let source = VecSource::new(vec![raw(1, "transfer"), raw(2, "execute")]);
        let sink = MemorySink::default();
        let mut worker = IngestWorker::new(WorkerConfig::default(), source, sink);

        let stats = worker.run_once().await.unwrap();

        assert_eq!(stats.fetched, 2);
        assert_eq!(stats.normalised, 2);
        assert_eq!(stats.persisted, 2);
        assert_eq!(stats.skipped, 0);
        assert_eq!(worker.current_checkpoint().unwrap().last_ledger_seq, 2);
    }

    #[tokio::test]
    async fn skips_out_of_order_events() {
        let source = VecSource::new(vec![raw(5, "transfer"), raw(3, "transfer")]);
        let sink = MemorySink::default();
        // Seed checkpoint at ledger 4 — ledger 3 is behind, ledger 5 is ahead
        let mut worker = IngestWorker::new(WorkerConfig::default(), source, sink)
            .with_checkpoint(Checkpoint { stream: "main".into(), last_ledger_seq: 4 });

        let stats = worker.run_once().await.unwrap();

        assert_eq!(stats.fetched, 2);
        assert_eq!(stats.skipped, 1);   // ledger 3 skipped
        assert_eq!(stats.normalised, 1); // ledger 5 processed
        assert_eq!(worker.current_checkpoint().unwrap().last_ledger_seq, 5);
    }

    #[tokio::test]
    async fn restart_recovery_resumes_from_checkpoint() {
        // First run: process ledgers 1-3
        let source1 = VecSource::new(vec![raw(1, "transfer"), raw(2, "transfer"), raw(3, "transfer")]);
        let sink = MemorySink::default();
        let mut worker = IngestWorker::new(WorkerConfig::default(), source1, sink);
        worker.run_once().await.unwrap();

        let cp = worker.current_checkpoint().unwrap();
        assert_eq!(cp.last_ledger_seq, 3);

        // Simulate restart: new worker seeded with saved checkpoint
        let source2 = VecSource::new(vec![raw(2, "transfer"), raw(3, "transfer"), raw(4, "transfer")]);
        let sink2 = MemorySink::default();
        let mut worker2 = IngestWorker::new(WorkerConfig::default(), source2, sink2)
            .with_checkpoint(cp);

        let stats = worker2.run_once().await.unwrap();

        // Ledgers 2 and 3 are behind the checkpoint — only 4 should be processed
        assert_eq!(stats.skipped, 2);
        assert_eq!(stats.normalised, 1);
        assert_eq!(worker2.current_checkpoint().unwrap().last_ledger_seq, 4);
    }

    #[tokio::test]
    async fn empty_source_returns_zero_stats() {
        let source = VecSource::new(vec![]);
        let sink = MemorySink::default();
        let mut worker = IngestWorker::new(WorkerConfig::default(), source, sink);

        let stats = worker.run_once().await.unwrap();

        assert_eq!(stats.fetched, 0);
        assert_eq!(stats.persisted, 0);
        assert!(worker.current_checkpoint().is_none());
    }

    #[tokio::test]
    async fn normalisation_error_increments_error_count() {
        // A raw event with an empty tx_hash will fail normalisation
        let mut bad = raw(10, "transfer");
        bad.tx_hash = String::new();

        let source = VecSource::new(vec![bad, raw(11, "transfer")]);
        let sink = MemorySink::default();
        let mut worker = IngestWorker::new(WorkerConfig::default(), source, sink);

        let stats = worker.run_once().await.unwrap();

        assert_eq!(stats.errors, 1);
        assert_eq!(stats.normalised, 1);
        // Checkpoint advances to the highest successfully processed ledger
        assert_eq!(worker.current_checkpoint().unwrap().last_ledger_seq, 11);
    }

    #[tokio::test]
    async fn checkpoint_not_advanced_when_nothing_persisted() {
        let source = VecSource::new(vec![raw(1, "transfer")]);
        let sink = MemorySink::default();
        // Checkpoint already at 5 — ledger 1 will be skipped
        let mut worker = IngestWorker::new(WorkerConfig::default(), source, sink)
            .with_checkpoint(Checkpoint { stream: "main".into(), last_ledger_seq: 5 });

        worker.run_once().await.unwrap();

        // Checkpoint must not regress
        assert_eq!(worker.current_checkpoint().unwrap().last_ledger_seq, 5);
    }
}
