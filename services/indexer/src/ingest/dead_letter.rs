//! Dead-letter store for events that fail normalisation.
//!
//! When [`crate::schema::canonical::normalise`] rejects a raw event the ingest
//! worker persists it here so the failure is observable and reprocessable
//! after a fix, instead of being silently dropped.

use anyhow::Context;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use super::sink::EventSink;
use crate::schema::canonical::{normalise, CanonicalEvent, RawEvent};

// ── Types ─────────────────────────────────────────────────────────────────────

/// A raw event that could not be normalised, retained for later reprocessing.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DeadLetterRecord {
    /// Ingestion stream that produced the failure.
    pub stream: String,
    /// Ledger sequence of the failed event.
    pub ledger_seq: u32,
    /// Human-readable normalisation error.
    pub error: String,
    /// Full raw event payload (recoverable input for reprocessing).
    pub raw: RawEvent,
    /// When the failure was recorded.
    pub failed_at: DateTime<Utc>,
}

/// A stored dead-letter row awaiting reprocessing, identified by its row id
/// so a caller can mark it resolved after a successful retry.
#[derive(Debug, Clone, PartialEq)]
pub struct PendingDeadLetter {
    pub id: Uuid,
    pub record: DeadLetterRecord,
}

// ── Trait ─────────────────────────────────────────────────────────────────────

/// Trait for durable storage of normalisation failures.
#[async_trait::async_trait]
pub trait DeadLetterStore: Send {
    /// Persist one or more dead-letter records.
    async fn persist_failures(&mut self, records: &[DeadLetterRecord]) -> anyhow::Result<()>;

    /// List up to `limit` dead-letter rows not yet marked reprocessed, oldest first.
    async fn list_unprocessed(&self, limit: i64) -> anyhow::Result<Vec<PendingDeadLetter>>;

    /// Mark the given dead-letter rows as successfully reprocessed.
    async fn mark_reprocessed(&mut self, ids: &[Uuid]) -> anyhow::Result<()>;
}

// ── Postgres implementation ───────────────────────────────────────────────────

/// Durable dead-letter store backed by PostgreSQL.
#[derive(Debug, Clone)]
pub struct PostgresDeadLetterStore {
    pool: PgPool,
}

impl PostgresDeadLetterStore {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait::async_trait]
impl DeadLetterStore for PostgresDeadLetterStore {
    async fn persist_failures(&mut self, records: &[DeadLetterRecord]) -> anyhow::Result<()> {
        persist_failures(&self.pool, records).await
    }

    async fn list_unprocessed(&self, limit: i64) -> anyhow::Result<Vec<PendingDeadLetter>> {
        list_unprocessed(&self.pool, limit).await
    }

    async fn mark_reprocessed(&mut self, ids: &[Uuid]) -> anyhow::Result<()> {
        mark_reprocessed(&self.pool, ids).await
    }
}

/// Insert dead-letter rows for later reprocessing.
pub async fn persist_failures(db: &PgPool, records: &[DeadLetterRecord]) -> anyhow::Result<()> {
    for record in records {
        let raw_payload =
            serde_json::to_value(&record.raw).context("serialize dead-letter raw payload")?;

        sqlx::query(
            "INSERT INTO ingest_dead_letters \
                (stream, ledger_seq, tx_hash, contract_id, error_message, raw_payload, created_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind(&record.stream)
        .bind(record.ledger_seq as i64)
        .bind(&record.raw.tx_hash)
        .bind(&record.raw.contract_id)
        .bind(&record.error)
        .bind(raw_payload)
        .bind(record.failed_at)
        .execute(db)
        .await
        .context("persist dead-letter record")?;
    }

    Ok(())
}

/// List up to `limit` dead-letter rows not yet marked reprocessed, oldest first.
pub async fn list_unprocessed(db: &PgPool, limit: i64) -> anyhow::Result<Vec<PendingDeadLetter>> {
    use sqlx::Row;

    let rows = sqlx::query(
        "SELECT id, stream, ledger_seq, error_message, raw_payload, created_at \
         FROM ingest_dead_letters \
         WHERE reprocessed_at IS NULL \
         ORDER BY created_at ASC \
         LIMIT $1",
    )
    .bind(limit)
    .fetch_all(db)
    .await
    .context("list unprocessed dead letters")?;

    rows.into_iter()
        .map(|row| {
            let id: Uuid = row.try_get("id").context("read dead-letter id")?;
            let stream: String = row.try_get("stream").context("read dead-letter stream")?;
            let ledger_seq: i64 = row
                .try_get("ledger_seq")
                .context("read dead-letter ledger_seq")?;
            let error: String = row
                .try_get("error_message")
                .context("read dead-letter error_message")?;
            let raw_payload: serde_json::Value = row
                .try_get("raw_payload")
                .context("read dead-letter raw_payload")?;
            let failed_at: DateTime<Utc> = row
                .try_get("created_at")
                .context("read dead-letter created_at")?;

            let raw: RawEvent = serde_json::from_value(raw_payload)
                .context("deserialize dead-letter raw_payload into RawEvent")?;

            Ok(PendingDeadLetter {
                id,
                record: DeadLetterRecord {
                    stream,
                    ledger_seq: ledger_seq as u32,
                    error,
                    raw,
                    failed_at,
                },
            })
        })
        .collect()
}

/// Mark the given dead-letter rows as successfully reprocessed.
pub async fn mark_reprocessed(db: &PgPool, ids: &[Uuid]) -> anyhow::Result<()> {
    if ids.is_empty() {
        return Ok(());
    }

    sqlx::query("UPDATE ingest_dead_letters SET reprocessed_at = NOW() WHERE id = ANY($1)")
        .bind(ids)
        .execute(db)
        .await
        .context("mark dead letters reprocessed")?;

    Ok(())
}

// ── Reprocessing ──────────────────────────────────────────────────────────────

/// Cumulative statistics produced by [`reprocess_dead_letters`].
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct ReprocessStats {
    /// Total unprocessed dead-letter rows examined.
    pub candidates: usize,
    /// Rows that still fail to normalise (left pending for a future retry).
    pub normalise_failed: usize,
    /// Rows successfully normalised, persisted, and marked reprocessed.
    pub persisted: usize,
}

/// Reprocess up to `limit` pending dead-letter rows: re-run each stored raw
/// payload through [`normalise`] and, on success, persist it via `sink` and
/// mark the row reprocessed. Rows that still fail to normalise are left
/// pending (not silently dropped) for a future retry after a further fix.
///
/// Deliberately does not touch the ingest checkpoint — dead letters are
/// replayed by row id, not by ledger cursor, so there's nothing for this to
/// corrupt or double-advance on the live worker's behalf.
pub async fn reprocess_dead_letters<D, Snk>(
    store: &mut D,
    sink: &mut Snk,
    limit: i64,
) -> anyhow::Result<ReprocessStats>
where
    D: DeadLetterStore,
    Snk: EventSink,
{
    let pending = store.list_unprocessed(limit).await?;

    let mut stats = ReprocessStats {
        candidates: pending.len(),
        ..Default::default()
    };

    let mut resolved_ids = Vec::with_capacity(pending.len());
    let mut canonical: Vec<CanonicalEvent> = Vec::with_capacity(pending.len());

    for item in pending {
        match normalise(item.record.raw) {
            Ok(ev) => {
                canonical.push(ev);
                resolved_ids.push(item.id);
            }
            Err(e) => {
                tracing::warn!(
                    dead_letter_id = %item.id,
                    error = %e,
                    "dead-letter row still fails to normalise, leaving pending"
                );
                stats.normalise_failed += 1;
            }
        }
    }

    if !canonical.is_empty() {
        sink.persist(&canonical)
            .await
            .context("persist reprocessed dead-letter events")?;
        store.mark_reprocessed(&resolved_ids).await?;
        stats.persisted = canonical.len();
    }

    Ok(stats)
}

// ── In-memory stub (tests) ────────────────────────────────────────────────────

/// Accumulates dead-letter records in memory for assertion in tests.
#[derive(Debug, Default)]
pub struct MemoryDeadLetterStore {
    pub records: Vec<DeadLetterRecord>,
    /// Row id parallel to `records` (index-for-index), so `list_unprocessed`
    /// / `mark_reprocessed` can be exercised without a real database.
    ids: Vec<Uuid>,
    resolved: std::collections::HashSet<Uuid>,
}

#[async_trait::async_trait]
impl DeadLetterStore for MemoryDeadLetterStore {
    async fn persist_failures(&mut self, records: &[DeadLetterRecord]) -> anyhow::Result<()> {
        for record in records {
            self.ids.push(Uuid::new_v4());
            self.records.push(record.clone());
        }
        Ok(())
    }

    async fn list_unprocessed(&self, limit: i64) -> anyhow::Result<Vec<PendingDeadLetter>> {
        Ok(self
            .ids
            .iter()
            .zip(self.records.iter())
            .filter(|(id, _)| !self.resolved.contains(id))
            .take(limit.max(0) as usize)
            .map(|(id, record)| PendingDeadLetter {
                id: *id,
                record: record.clone(),
            })
            .collect())
    }

    async fn mark_reprocessed(&mut self, ids: &[Uuid]) -> anyhow::Result<()> {
        self.resolved.extend(ids.iter().copied());
        Ok(())
    }
}

// ── Failing stub (tests) ──────────────────────────────────────────────────────

/// A dead-letter store that always returns an error.
pub struct FailingDeadLetterStore;

#[async_trait::async_trait]
impl DeadLetterStore for FailingDeadLetterStore {
    async fn persist_failures(&mut self, _records: &[DeadLetterRecord]) -> anyhow::Result<()> {
        Err(anyhow::anyhow!("simulated dead-letter store failure"))
    }

    async fn list_unprocessed(&self, _limit: i64) -> anyhow::Result<Vec<PendingDeadLetter>> {
        Err(anyhow::anyhow!("simulated dead-letter store failure"))
    }

    async fn mark_reprocessed(&mut self, _ids: &[Uuid]) -> anyhow::Result<()> {
        Err(anyhow::anyhow!("simulated dead-letter store failure"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn sample_record() -> DeadLetterRecord {
        DeadLetterRecord {
            stream: "main".into(),
            ledger_seq: 42,
            error: "Missing required field: tx_hash".into(),
            raw: RawEvent {
                ledger_seq: 42,
                ledger_close_time: Utc::now(),
                tx_hash: String::new(),
                contract_id: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN".into(),
                topics: vec!["transfer".into()],
                data: String::new(),
            },
            failed_at: Utc::now(),
        }
    }

    #[tokio::test]
    async fn memory_store_accumulates_records() {
        let mut store = MemoryDeadLetterStore::default();
        let record = sample_record();
        store.persist_failures(&[record.clone()]).await.unwrap();
        assert_eq!(store.records.len(), 1);
        assert_eq!(store.records[0].ledger_seq, 42);
        assert_eq!(store.records[0].error, record.error);
    }

    #[tokio::test]
    async fn failing_store_returns_error() {
        let mut store = FailingDeadLetterStore;
        let err = store
            .persist_failures(&[sample_record()])
            .await
            .unwrap_err();
        assert!(err.to_string().contains("simulated dead-letter"));
    }

    fn recoverable_record() -> DeadLetterRecord {
        // Unlike `sample_record()`, this has a non-empty tx_hash/contract_id
        // so `normalise()` succeeds — simulates a dead letter caused by a
        // normalisation bug that has since been fixed.
        DeadLetterRecord {
            stream: "main".into(),
            ledger_seq: 100,
            error: "some now-fixed bug".into(),
            raw: RawEvent {
                ledger_seq: 100,
                ledger_close_time: Utc::now(),
                tx_hash: format!("{:0>64}", 100),
                contract_id: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN".into(),
                topics: vec!["transfer".into()],
                data: String::new(),
            },
            failed_at: Utc::now(),
        }
    }

    mod reprocess {
        use super::*;
        use crate::ingest::sink::MemorySink;

        #[tokio::test]
        async fn marks_recoverable_rows_reprocessed_and_persists_them() {
            let mut store = MemoryDeadLetterStore::default();
            store
                .persist_failures(&[recoverable_record()])
                .await
                .unwrap();
            let mut sink = MemorySink::default();

            let stats = reprocess_dead_letters(&mut store, &mut sink, 10)
                .await
                .unwrap();

            assert_eq!(stats.candidates, 1);
            assert_eq!(stats.persisted, 1);
            assert_eq!(stats.normalise_failed, 0);
            assert_eq!(sink.events.len(), 1);
            assert!(store.list_unprocessed(10).await.unwrap().is_empty());
        }

        #[tokio::test]
        async fn leaves_still_failing_rows_pending() {
            let mut store = MemoryDeadLetterStore::default();
            store.persist_failures(&[sample_record()]).await.unwrap(); // still fails normalise
            let mut sink = MemorySink::default();

            let stats = reprocess_dead_letters(&mut store, &mut sink, 10)
                .await
                .unwrap();

            assert_eq!(stats.candidates, 1);
            assert_eq!(stats.persisted, 0);
            assert_eq!(stats.normalise_failed, 1);
            assert!(sink.events.is_empty());
            assert_eq!(store.list_unprocessed(10).await.unwrap().len(), 1);
        }

        #[tokio::test]
        async fn empty_store_returns_zero_stats() {
            let mut store = MemoryDeadLetterStore::default();
            let mut sink = MemorySink::default();

            let stats = reprocess_dead_letters(&mut store, &mut sink, 10)
                .await
                .unwrap();

            assert_eq!(stats, ReprocessStats::default());
        }

        #[tokio::test]
        async fn a_second_run_after_success_finds_nothing_left_to_do() {
            let mut store = MemoryDeadLetterStore::default();
            store
                .persist_failures(&[recoverable_record()])
                .await
                .unwrap();
            let mut sink = MemorySink::default();

            reprocess_dead_letters(&mut store, &mut sink, 10)
                .await
                .unwrap();
            let second_run = reprocess_dead_letters(&mut store, &mut sink, 10)
                .await
                .unwrap();

            assert_eq!(second_run, ReprocessStats::default());
        }

        #[tokio::test]
        async fn respects_the_limit() {
            let mut store = MemoryDeadLetterStore::default();
            store
                .persist_failures(&[recoverable_record(), recoverable_record()])
                .await
                .unwrap();
            let mut sink = MemorySink::default();

            let stats = reprocess_dead_letters(&mut store, &mut sink, 1)
                .await
                .unwrap();

            assert_eq!(stats.candidates, 1);
            assert_eq!(store.list_unprocessed(10).await.unwrap().len(), 1);
        }
    }

    mod postgres_integration {
        use super::*;
        use crate::ingest::checkpoint::{Checkpoint, CheckpointStore, PostgresCheckpointStore};
        use crate::ingest::postgres_sink::PostgresEventSink;

        async fn setup_test_db() -> PgPool {
            dotenvy::dotenv().ok();
            let database_url = std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| {
                "postgresql://postgres:postgres@localhost:5432/ancore_test".to_string()
            });
            let pool = PgPool::connect(&database_url)
                .await
                .expect("failed to connect to test database (run migrations first)");

            // `list_unprocessed` has no per-test scoping filter by design (a
            // real reprocess run should see every pending row) — so, unlike
            // postgres_sink's tests, these tests need a clean table to avoid
            // picking up rows left by another test running concurrently
            // against the same database.
            sqlx::query("TRUNCATE TABLE ingest_dead_letters")
                .execute(&pool)
                .await
                .expect("failed to truncate ingest_dead_letters");

            pool
        }

        fn recoverable_dead_letter(tag: &str) -> DeadLetterRecord {
            let tx_hash = format!("{:0>64}", tag);
            DeadLetterRecord {
                stream: "main".into(),
                ledger_seq: 900_100,
                error: "some now-fixed bug".into(),
                raw: RawEvent {
                    ledger_seq: 900_100,
                    ledger_close_time: Utc::now(),
                    tx_hash,
                    contract_id: "CTESTDEADLETTER0000000000000000000000000000000000000".into(),
                    topics: vec!["transfer".into()],
                    data: String::new(),
                },
                failed_at: Utc::now(),
            }
        }

        #[tokio::test]
        #[ignore] // Requires test database
        async fn reprocess_round_trip_persists_events_and_marks_rows_reprocessed() {
            let pool = setup_test_db().await;
            let mut store = PostgresDeadLetterStore::new(pool.clone());
            let record = recoverable_dead_letter("dlreprocess1");
            // Scoped cleanup so re-running this test locally doesn't leave
            // stale rows behind that would break the fetch_one calls below.
            sqlx::query("DELETE FROM ingest_dead_letters WHERE tx_hash = $1")
                .bind(&record.raw.tx_hash)
                .execute(&pool)
                .await
                .unwrap();
            store.persist_failures(&[record.clone()]).await.unwrap();

            let mut sink = PostgresEventSink::new(pool.clone());
            let stats = reprocess_dead_letters(&mut store, &mut sink, 100)
                .await
                .unwrap();

            assert_eq!(stats.persisted, 1);
            assert_eq!(stats.normalise_failed, 0);

            let contract_event_count: i64 =
                sqlx::query_scalar("SELECT COUNT(*) FROM contract_events WHERE tx_hash = $1")
                    .bind(&record.raw.tx_hash)
                    .fetch_one(&pool)
                    .await
                    .unwrap();
            assert_eq!(contract_event_count, 1);

            let reprocessed_at: Option<DateTime<Utc>> = sqlx::query_scalar(
                "SELECT reprocessed_at FROM ingest_dead_letters WHERE tx_hash = $1",
            )
            .bind(&record.raw.tx_hash)
            .fetch_one(&pool)
            .await
            .unwrap();
            assert!(reprocessed_at.is_some());

            // A second run must find nothing left to do — the row is resolved.
            let second_run = reprocess_dead_letters(&mut store, &mut sink, 100)
                .await
                .unwrap();
            assert_eq!(second_run.candidates, 0);
        }

        #[tokio::test]
        #[ignore] // Requires test database
        async fn reprocessing_does_not_touch_the_live_ingest_checkpoint() {
            let pool = setup_test_db().await;

            // Seed a live-worker checkpoint the way the real worker would have.
            let checkpoint_store = PostgresCheckpointStore::new(pool.clone());
            checkpoint_store
                .save(&Checkpoint {
                    stream: "main".into(),
                    last_ledger_seq: 12_345,
                })
                .await
                .unwrap();

            let mut store = PostgresDeadLetterStore::new(pool.clone());
            store
                .persist_failures(&[recoverable_dead_letter("dlcheckpointsafety1")])
                .await
                .unwrap();
            let mut sink = PostgresEventSink::new(pool.clone());
            reprocess_dead_letters(&mut store, &mut sink, 100)
                .await
                .unwrap();

            let checkpoint_after = checkpoint_store.load("main").await.unwrap().unwrap();
            assert_eq!(
                checkpoint_after.last_ledger_seq, 12_345,
                "dead-letter reprocessing must never advance/alter the live ingest checkpoint"
            );
        }
    }
}
