//! Ingestion worker.
//!
//! [`IngestWorker`] pulls batches of [`RawEvent`]s from a source, normalises
//! them into [`CanonicalEvent`]s, persists them, and advances the checkpoint
//! cursor.  Out-of-order events (ledger_seq ≤ last checkpoint) are silently
//! skipped to guarantee idempotent restarts.
//!
//! Events that fail normalisation are written to a [`DeadLetterStore`] and
//! counted via [`crate::metrics::record_normalise_failure`] so failures are
//! observable and recoverable rather than silently dropped.

use anyhow::Context;
use chrono::Utc;
use tracing::{debug, error, info, warn};

use super::checkpoint::{Checkpoint, CheckpointStore, MemoryCheckpointStore};
use super::dead_letter::{DeadLetterRecord, DeadLetterStore, MemoryDeadLetterStore};
use super::sink::EventSink;
use super::source::EventSource;
use crate::metrics;
use crate::schema::canonical::{normalise, CanonicalEvent};

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
    /// Events written to the dead-letter store after a normalisation failure.
    pub dead_lettered: usize,
}

/// The ingestion worker.
///
/// Designed to be testable without a real database: the checkpoint store,
/// event source, event sink, and dead-letter store are all injected.
pub struct IngestWorker<Src, Snk, Cp = MemoryCheckpointStore, Dl = MemoryDeadLetterStore> {
    config: WorkerConfig,
    checkpoint: Cp,
    source: Src,
    sink: Snk,
    dead_letters: Dl,
}

impl<Src, Snk> IngestWorker<Src, Snk, MemoryCheckpointStore, MemoryDeadLetterStore>
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
            dead_letters: MemoryDeadLetterStore::default(),
        }
    }

    /// Seed the worker with an existing checkpoint (sync; memory store only).
    pub fn with_initial_checkpoint(self, cp: Checkpoint) -> Self {
        self.checkpoint.save_sync(&cp);
        self
    }
}

impl<Src, Snk, Cp> IngestWorker<Src, Snk, Cp, MemoryDeadLetterStore>
where
    Src: EventSource,
    Snk: EventSink,
    Cp: CheckpointStore,
{
    pub fn with_checkpoint_store(
        config: WorkerConfig,
        source: Src,
        sink: Snk,
        checkpoint: Cp,
    ) -> Self {
        Self {
            config,
            checkpoint,
            source,
            sink,
            dead_letters: MemoryDeadLetterStore::default(),
        }
    }
}

impl<Src, Snk, Cp, Dl> IngestWorker<Src, Snk, Cp, Dl>
where
    Src: EventSource,
    Snk: EventSink,
    Cp: CheckpointStore,
    Dl: DeadLetterStore,
{
    /// Replace the dead-letter store (defaults to [`MemoryDeadLetterStore`]).
    pub fn with_dead_letter_store<D: DeadLetterStore>(
        self,
        dead_letters: D,
    ) -> IngestWorker<Src, Snk, Cp, D> {
        IngestWorker {
            config: self.config,
            checkpoint: self.checkpoint,
            source: self.source,
            sink: self.sink,
            dead_letters,
        }
    }

    /// Load an existing checkpoint from the store and seed the worker.
    pub async fn bootstrap_from_store(self) -> anyhow::Result<Self> {
        if let Some(cp) = self
            .checkpoint
            .load(&self.config.stream)
            .await
            .context("load checkpoint on startup")?
        {
            self.checkpoint.save(&cp).await?;
        }
        Ok(self)
    }

    /// Seed the worker with an existing checkpoint value.
    pub async fn with_checkpoint(self, cp: Checkpoint) -> anyhow::Result<Self> {
        self.checkpoint.save(&cp).await?;
        Ok(self)
    }

    /// Process one batch of events.
    ///
    /// Returns [`BatchStats`] describing what happened.
    pub async fn run_once(&mut self) -> anyhow::Result<BatchStats> {
        let last_seq = self
            .checkpoint
            .load(&self.config.stream)
            .await
            .context("load checkpoint")?
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
        let mut failures: Vec<DeadLetterRecord> = Vec::new();
        let mut max_ledger = last_seq;

        for raw in raw_events {
            // Skip out-of-order / already-processed events
            if raw.ledger_seq <= last_seq {
                warn!(
                    ledger_seq = raw.ledger_seq,
                    last_seq, "skipping out-of-order event"
                );
                stats.skipped += 1;
                continue;
            }

            let ledger_seq = raw.ledger_seq;
            match normalise(raw.clone()) {
                Ok(ev) => {
                    max_ledger = max_ledger.max(ev.ledger_seq);
                    canonical.push(ev);
                    stats.normalised += 1;
                }
                Err(e) => {
                    metrics::record_normalise_failure();
                    error!(
                        error = %e,
                        ledger_seq,
                        tx_hash = %raw.tx_hash,
                        contract_id = %raw.contract_id,
                        raw_payload = ?raw,
                        "failed to normalise event; writing to dead-letter store"
                    );
                    failures.push(DeadLetterRecord {
                        stream: self.config.stream.clone(),
                        ledger_seq,
                        error: e.to_string(),
                        raw,
                        failed_at: Utc::now(),
                    });
                    // Advance past the failed ledger once it is queued for DLQ —
                    // recovery is via reprocessing dead letters, not by stalling.
                    max_ledger = max_ledger.max(ledger_seq);
                    stats.errors += 1;
                }
            }
        }

        if !failures.is_empty() {
            let count = failures.len();
            self.dead_letters
                .persist_failures(&failures)
                .await
                .context("persist dead-letter records")?;
            stats.dead_lettered = count;
        }

        if !canonical.is_empty() {
            self.sink
                .persist(&canonical)
                .await
                .context("persist canonical events")?;
            stats.persisted = canonical.len();
        }

        // Advance checkpoint after successful sink + DLQ writes so we do not
        // re-fetch events that were either persisted or dead-lettered.
        if max_ledger > last_seq {
            self.checkpoint
                .save(&Checkpoint {
                    stream: self.config.stream.clone(),
                    last_ledger_seq: max_ledger,
                })
                .await
                .context("save checkpoint")?;

            info!(
                stream = %self.config.stream,
                persisted = stats.persisted,
                dead_lettered = stats.dead_lettered,
                max_ledger,
                "batch committed"
            );
        }

        Ok(stats)
    }

    /// Current checkpoint (for inspection / testing).
    pub async fn current_checkpoint(&self) -> Option<Checkpoint> {
        self.checkpoint
            .load(&self.config.stream)
            .await
            .ok()
            .flatten()
    }

    /// Borrow the dead-letter store (for inspection / testing).
    pub fn dead_letter_store(&self) -> &Dl {
        &self.dead_letters
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ingest::dead_letter::FailingDeadLetterStore;
    use crate::ingest::sink::MemorySink;
    use crate::ingest::source::VecSource;
    use crate::schema::canonical::RawEvent;
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
        let source = VecSource::new(vec![raw(1, "transfer"), raw(2, "transfer")]);
        let sink = MemorySink::default();
        let mut worker = IngestWorker::new(WorkerConfig::default(), source, sink);

        let stats = worker.run_once().await.unwrap();

        assert_eq!(stats.fetched, 2);
        assert_eq!(stats.normalised, 2);
        assert_eq!(stats.persisted, 2);
        assert_eq!(stats.skipped, 0);
        assert_eq!(stats.dead_lettered, 0);
        assert_eq!(
            worker.current_checkpoint().await.unwrap().last_ledger_seq,
            2
        );
    }

    #[tokio::test]
    async fn skips_out_of_order_events() {
        let source = VecSource::new(vec![raw(5, "transfer"), raw(3, "transfer")]);
        let sink = MemorySink::default();
        let mut worker = IngestWorker::new(WorkerConfig::default(), source, sink)
            .with_initial_checkpoint(Checkpoint {
                stream: "main".into(),
                last_ledger_seq: 4,
            });

        let stats = worker.run_once().await.unwrap();

        assert_eq!(stats.fetched, 2);
        assert_eq!(stats.skipped, 1);
        assert_eq!(stats.normalised, 1);
        assert_eq!(
            worker.current_checkpoint().await.unwrap().last_ledger_seq,
            5
        );
    }

    #[tokio::test]
    async fn restart_recovery_resumes_from_checkpoint() {
        let source1 = VecSource::new(vec![
            raw(1, "transfer"),
            raw(2, "transfer"),
            raw(3, "transfer"),
        ]);
        let sink = MemorySink::default();
        let mut worker = IngestWorker::new(WorkerConfig::default(), source1, sink);
        worker.run_once().await.unwrap();

        let cp = worker.current_checkpoint().await.unwrap();
        assert_eq!(cp.last_ledger_seq, 3);

        let source2 = VecSource::new(vec![
            raw(2, "transfer"),
            raw(3, "transfer"),
            raw(4, "transfer"),
        ]);
        let sink2 = MemorySink::default();
        let mut worker2 =
            IngestWorker::new(WorkerConfig::default(), source2, sink2).with_initial_checkpoint(cp);

        let stats = worker2.run_once().await.unwrap();

        assert_eq!(stats.skipped, 2);
        assert_eq!(stats.normalised, 1);
        assert_eq!(
            worker2.current_checkpoint().await.unwrap().last_ledger_seq,
            4
        );
    }

    #[tokio::test]
    async fn empty_source_returns_zero_stats() {
        let source = VecSource::new(vec![]);
        let sink = MemorySink::default();
        let mut worker = IngestWorker::new(WorkerConfig::default(), source, sink);

        let stats = worker.run_once().await.unwrap();

        assert_eq!(stats.fetched, 0);
        assert_eq!(stats.persisted, 0);
        assert!(worker.current_checkpoint().await.is_none());
    }

    #[tokio::test]
    async fn normalisation_failure_writes_dead_letter_and_increments_errors() {
        let mut bad = raw(10, "transfer");
        bad.tx_hash = String::new();

        let source = VecSource::new(vec![bad, raw(11, "transfer")]);
        let sink = MemorySink::default();
        let mut worker = IngestWorker::new(WorkerConfig::default(), source, sink);

        let stats = worker.run_once().await.unwrap();

        assert_eq!(stats.errors, 1);
        assert_eq!(stats.dead_lettered, 1);
        assert_eq!(stats.normalised, 1);
        assert_eq!(stats.persisted, 1);

        let dlq = worker.dead_letter_store();
        assert_eq!(dlq.records.len(), 1);
        assert_eq!(dlq.records[0].ledger_seq, 10);
        assert_eq!(dlq.records[0].raw.tx_hash, "");
        assert!(dlq.records[0].error.contains("tx_hash"));

        assert_eq!(
            worker.current_checkpoint().await.unwrap().last_ledger_seq,
            11
        );
    }

    #[tokio::test]
    async fn normalisation_failure_only_still_advances_checkpoint_after_dlq() {
        let mut bad = raw(7, "transfer");
        bad.tx_hash = String::new();

        let source = VecSource::new(vec![bad]);
        let sink = MemorySink::default();
        let mut worker = IngestWorker::new(WorkerConfig::default(), source, sink);

        let stats = worker.run_once().await.unwrap();

        assert_eq!(stats.errors, 1);
        assert_eq!(stats.dead_lettered, 1);
        assert_eq!(stats.persisted, 0);
        assert_eq!(worker.dead_letter_store().records.len(), 1);
        assert_eq!(
            worker.current_checkpoint().await.unwrap().last_ledger_seq,
            7
        );
    }

    #[tokio::test]
    async fn dead_letter_store_failure_aborts_batch_without_advancing_checkpoint() {
        let mut bad = raw(10, "transfer");
        bad.tx_hash = String::new();

        let source = VecSource::new(vec![bad, raw(11, "transfer")]);
        let sink = MemorySink::default();
        let mut worker = IngestWorker::new(WorkerConfig::default(), source, sink)
            .with_dead_letter_store(FailingDeadLetterStore);

        let err = worker.run_once().await.unwrap_err();
        assert!(err.to_string().contains("dead-letter"));
        assert!(worker.current_checkpoint().await.is_none());
    }

    #[tokio::test]
    async fn checkpoint_not_advanced_when_nothing_persisted() {
        let source = VecSource::new(vec![raw(1, "transfer")]);
        let sink = MemorySink::default();
        let mut worker = IngestWorker::new(WorkerConfig::default(), source, sink)
            .with_initial_checkpoint(Checkpoint {
                stream: "main".into(),
                last_ledger_seq: 5,
            });

        worker.run_once().await.unwrap();

        assert_eq!(
            worker.current_checkpoint().await.unwrap().last_ledger_seq,
            5
        );
    }
}
