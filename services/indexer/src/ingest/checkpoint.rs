//! Checkpoint cursor persistence.
//!
//! The checkpoint records the last successfully processed ledger sequence so
//! the ingestion worker can resume from the correct position after a restart.

use anyhow::Context;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};

// ── Types ─────────────────────────────────────────────────────────────────────

/// A persisted ingestion checkpoint.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Checkpoint {
    /// Name of the ingestion stream (allows multiple independent workers).
    pub stream: String,
    /// Last ledger sequence that was fully processed and committed.
    pub last_ledger_seq: u32,
}

// ── Repository trait ──────────────────────────────────────────────────────────

/// Trait for durable checkpoint persistence.
#[async_trait::async_trait]
pub trait CheckpointStore: Send + Sync {
    /// Load the current checkpoint for `stream`, returning `None` on first run.
    async fn load(&self, stream: &str) -> anyhow::Result<Option<Checkpoint>>;

    /// Persist (upsert) a checkpoint.
    async fn save(&self, checkpoint: &Checkpoint) -> anyhow::Result<()>;
}

// ── Postgres implementation ───────────────────────────────────────────────────

/// Durable checkpoint store backed by PostgreSQL.
#[derive(Debug, Clone)]
pub struct PostgresCheckpointStore {
    pool: PgPool,
}

impl PostgresCheckpointStore {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait::async_trait]
impl CheckpointStore for PostgresCheckpointStore {
    async fn load(&self, stream: &str) -> anyhow::Result<Option<Checkpoint>> {
        load(&self.pool, stream).await
    }

    async fn save(&self, checkpoint: &Checkpoint) -> anyhow::Result<()> {
        save(&self.pool, checkpoint).await
    }
}

// ── Repository helpers ──────────────────────────────────────────────────────────

/// Load the current checkpoint for `stream`, returning `None` if no checkpoint
/// exists yet (i.e. first run).
pub async fn load(db: &PgPool, stream: &str) -> anyhow::Result<Option<Checkpoint>> {
    let row = sqlx::query(
        "SELECT last_ledger_seq FROM ingest_checkpoints WHERE stream = $1",
    )
    .bind(stream)
    .fetch_optional(db)
    .await
    .context("load checkpoint")?;

    Ok(row.map(|r| Checkpoint {
        stream: stream.to_owned(),
        last_ledger_seq: r.try_get::<i64, _>("last_ledger_seq").unwrap_or(0) as u32,
    }))
}

/// Persist (upsert) a checkpoint.
pub async fn save(db: &PgPool, checkpoint: &Checkpoint) -> anyhow::Result<()> {
    sqlx::query(
        "INSERT INTO ingest_checkpoints (stream, last_ledger_seq, updated_at) \
         VALUES ($1, $2, NOW()) \
         ON CONFLICT (stream) \
         DO UPDATE SET last_ledger_seq = EXCLUDED.last_ledger_seq, \
                       updated_at      = EXCLUDED.updated_at",
    )
    .bind(&checkpoint.stream)
    .bind(checkpoint.last_ledger_seq as i64)
    .execute(db)
    .await
    .context("save checkpoint")?;

    Ok(())
}

// ── In-memory stub (used in unit tests) ──────────────────────────────────────

/// A simple in-memory checkpoint store for unit testing without a real DB.
#[derive(Debug, Default)]
pub struct MemoryCheckpointStore {
    inner: std::sync::Mutex<std::collections::HashMap<String, u32>>,
}

impl MemoryCheckpointStore {
    pub fn load_sync(&self, stream: &str) -> Option<Checkpoint> {
        self.inner
            .lock()
            .expect("memory checkpoint store lock poisoned")
            .get(stream)
            .map(|&seq| Checkpoint {
                stream: stream.to_owned(),
                last_ledger_seq: seq,
            })
    }

    pub fn save_sync(&self, checkpoint: &Checkpoint) {
        self.inner
            .lock()
            .expect("memory checkpoint store lock poisoned")
            .insert(checkpoint.stream.clone(), checkpoint.last_ledger_seq);
    }
}

#[async_trait::async_trait]
impl CheckpointStore for MemoryCheckpointStore {
    async fn load(&self, stream: &str) -> anyhow::Result<Option<Checkpoint>> {
        Ok(self.load_sync(stream))
    }

    async fn save(&self, checkpoint: &Checkpoint) -> anyhow::Result<()> {
        self.save_sync(checkpoint);
        Ok(())
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn memory_store_returns_none_on_first_run() {
        let store = MemoryCheckpointStore::default();
        assert!(store.load_sync("main").is_none());
    }

    #[test]
    fn memory_store_roundtrip() {
        let store = MemoryCheckpointStore::default();
        let cp = Checkpoint {
            stream: "main".into(),
            last_ledger_seq: 42,
        };
        store.save_sync(&cp);
        let loaded = store.load_sync("main").unwrap();
        assert_eq!(loaded.last_ledger_seq, 42);
    }

    #[test]
    fn memory_store_upserts() {
        let store = MemoryCheckpointStore::default();
        store.save_sync(&Checkpoint { stream: "main".into(), last_ledger_seq: 10 });
        store.save_sync(&Checkpoint { stream: "main".into(), last_ledger_seq: 20 });
        assert_eq!(store.load_sync("main").unwrap().last_ledger_seq, 20);
    }

    #[test]
    fn memory_store_independent_streams() {
        let store = MemoryCheckpointStore::default();
        store.save_sync(&Checkpoint { stream: "a".into(), last_ledger_seq: 1 });
        store.save_sync(&Checkpoint { stream: "b".into(), last_ledger_seq: 99 });
        assert_eq!(store.load_sync("a").unwrap().last_ledger_seq, 1);
        assert_eq!(store.load_sync("b").unwrap().last_ledger_seq, 99);
    }

    #[tokio::test]
    async fn memory_store_trait_roundtrip() {
        let store = MemoryCheckpointStore::default();
        let cp = Checkpoint {
            stream: "main".into(),
            last_ledger_seq: 7,
        };
        store.save(&cp).await.unwrap();
        let loaded = store.load("main").await.unwrap().unwrap();
        assert_eq!(loaded, cp);
    }

    mod postgres_integration {
        use super::*;
        use crate::ingest::sink::MemorySink;
        use crate::ingest::source::VecSource;
        use crate::ingest::worker::{IngestWorker, WorkerConfig};
        use crate::schema::canonical::RawEvent;
        use chrono::Utc;

        async fn setup_test_db() -> PgPool {
            dotenvy::dotenv().ok();

            let database_url = std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| {
                "postgresql://postgres:postgres@localhost:5432/ancore_test".to_string()
            });

            let pool = PgPool::connect(&database_url)
                .await
                .expect("Failed to connect to test database");

            sqlx::query(
                "CREATE TABLE IF NOT EXISTS ingest_checkpoints ( \
                    stream VARCHAR(64) PRIMARY KEY, \
                    last_ledger_seq BIGINT NOT NULL, \
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW() \
                )",
            )
            .execute(&pool)
            .await
            .expect("Failed to ensure ingest_checkpoints table exists");

            sqlx::query("TRUNCATE TABLE ingest_checkpoints")
                .execute(&pool)
                .await
                .expect("Failed to truncate ingest_checkpoints");

            pool
        }

        fn raw_event(ledger_seq: u32) -> RawEvent {
            RawEvent {
                ledger_seq,
                ledger_close_time: Utc::now(),
                tx_hash: format!("{:0>64}", ledger_seq),
                contract_id: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN".into(),
                topics: vec!["transfer".into()],
                data: String::new(),
            }
        }

        #[tokio::test]
        #[ignore] // Requires test database
        async fn postgres_checkpoint_survives_restart() {
            let pool = setup_test_db().await;
            let store = PostgresCheckpointStore::new(pool.clone());

            store
                .save(&Checkpoint {
                    stream: "main".into(),
                    last_ledger_seq: 42,
                })
                .await
                .unwrap();

            let restarted = PostgresCheckpointStore::new(pool);
            let loaded = restarted.load("main").await.unwrap().unwrap();
            assert_eq!(loaded.last_ledger_seq, 42);
        }

        #[tokio::test]
        #[ignore] // Requires test database
        async fn postgres_checkpoint_replay_does_not_duplicate_events() {
            let pool = setup_test_db().await;
            let store = PostgresCheckpointStore::new(pool.clone());

            let source1 = VecSource::new(vec![
                raw_event(1),
                raw_event(2),
                raw_event(3),
            ]);
            let sink1 = MemorySink::default();
            let mut worker = IngestWorker::with_checkpoint_store(
                WorkerConfig::default(),
                source1,
                sink1,
                store.clone(),
            );
            worker.run_once().await.unwrap();

            let source2 = VecSource::new(vec![
                raw_event(2),
                raw_event(3),
                raw_event(4),
            ]);
            let sink2 = MemorySink::default();
            let mut worker2 = IngestWorker::with_checkpoint_store(
                WorkerConfig::default(),
                source2,
                sink2,
                PostgresCheckpointStore::new(pool),
            );

            let stats = worker2.run_once().await.unwrap();
            assert_eq!(stats.skipped, 2);
            assert_eq!(stats.normalised, 1);
            assert_eq!(worker2.current_checkpoint().await.unwrap().last_ledger_seq, 4);
        }
    }

    // ── Serialization tests ───────────────────────────────────────────────────

    mod serialization {
        use super::*;
        use crate::ingest::sink::MemorySink;
        use crate::ingest::source::VecSource;
        use crate::ingest::worker::{IngestWorker, WorkerConfig};
        use crate::schema::canonical::RawEvent;
        use chrono::Utc;

        fn make_cp(stream: &str, seq: u32) -> Checkpoint {
            Checkpoint { stream: stream.into(), last_ledger_seq: seq }
        }

        fn raw_event(ledger_seq: u32) -> RawEvent {
            RawEvent {
                ledger_seq,
                ledger_close_time: Utc::now(),
                tx_hash: format!("{:0>64}", ledger_seq),
                contract_id: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN".into(),
                topics: vec!["transfer".into()],
                data: String::new(),
            }
        }

        #[test]
        fn json_roundtrip() {
            let cp = make_cp("main", 12345);
            let json = serde_json::to_string(&cp).expect("serialize");
            let restored: Checkpoint = serde_json::from_str(&json).expect("deserialize");
            assert_eq!(cp, restored);
        }

        #[test]
        fn roundtrip_preserves_stream_name() {
            let cp = make_cp("stream with spaces / unicode 🌟", 99);
            let json = serde_json::to_string(&cp).unwrap();
            let restored: Checkpoint = serde_json::from_str(&json).unwrap();
            assert_eq!(restored.stream, cp.stream);
        }

        #[test]
        fn roundtrip_boundary_value_zero() {
            let cp = make_cp("main", 0);
            let json = serde_json::to_string(&cp).unwrap();
            let restored: Checkpoint = serde_json::from_str(&json).unwrap();
            assert_eq!(restored.last_ledger_seq, 0);
        }

        #[test]
        fn roundtrip_boundary_value_u32_max() {
            let cp = make_cp("main", u32::MAX);
            let json = serde_json::to_string(&cp).unwrap();
            let restored: Checkpoint = serde_json::from_str(&json).unwrap();
            assert_eq!(restored.last_ledger_seq, u32::MAX);
        }

        #[test]
        fn deserialize_corrupted_json_returns_error() {
            let result: Result<Checkpoint, _> = serde_json::from_str("{not valid json!!!}");
            assert!(result.is_err(), "corrupted JSON must not deserialize");
        }

        #[test]
        fn deserialize_empty_string_returns_error() {
            let result: Result<Checkpoint, _> = serde_json::from_str("");
            assert!(result.is_err());
        }

        #[test]
        fn deserialize_missing_last_ledger_seq_returns_error() {
            let json = r#"{"stream":"main"}"#;
            let result: Result<Checkpoint, _> = serde_json::from_str(json);
            assert!(result.is_err(), "missing last_ledger_seq must fail");
        }

        #[test]
        fn deserialize_missing_stream_returns_error() {
            let json = r#"{"last_ledger_seq":42}"#;
            let result: Result<Checkpoint, _> = serde_json::from_str(json);
            assert!(result.is_err(), "missing stream must fail");
        }

        #[test]
        fn deserialize_extra_fields_are_ignored() {
            // Forward-compatibility: unknown keys from a newer format must not break parsing.
            let json = r#"{"stream":"main","last_ledger_seq":7,"_future_field":"x","v":2}"#;
            let cp: Checkpoint = serde_json::from_str(json).expect("extra fields should be ignored");
            assert_eq!(cp.stream, "main");
            assert_eq!(cp.last_ledger_seq, 7);
        }

        #[test]
        fn deserialize_wrong_type_for_seq_returns_error() {
            let json = r#"{"stream":"main","last_ledger_seq":"not-a-number"}"#;
            let result: Result<Checkpoint, _> = serde_json::from_str(json);
            assert!(result.is_err(), "string where u32 expected must fail");
        }

        #[test]
        fn deserialize_negative_seq_returns_error() {
            // u32 cannot represent -1; serde must reject it.
            let json = r#"{"stream":"main","last_ledger_seq":-1}"#;
            let result: Result<Checkpoint, _> = serde_json::from_str(json);
            assert!(result.is_err(), "negative seq must fail for u32 field");
        }

        #[test]
        fn legacy_i64_range_seq_roundtrips() {
            // The DB stores last_ledger_seq as i64; values ≤ i32::MAX must survive a
            // serialize → deserialize cycle when the JSON integer is within u32 range.
            let seq: u32 = i32::MAX as u32; // 2_147_483_647
            let cp = make_cp("main", seq);
            let json = serde_json::to_string(&cp).unwrap();
            let restored: Checkpoint = serde_json::from_str(&json).unwrap();
            assert_eq!(restored.last_ledger_seq, seq);
        }

        #[test]
        fn multiple_streams_serialize_independently() {
            let cp_a = make_cp("stream-a", 10);
            let cp_b = make_cp("stream-b", 200);
            let json_a = serde_json::to_string(&cp_a).unwrap();
            let json_b = serde_json::to_string(&cp_b).unwrap();
            // Each deserializes to its own value without contamination.
            let restored_a: Checkpoint = serde_json::from_str(&json_a).unwrap();
            let restored_b: Checkpoint = serde_json::from_str(&json_b).unwrap();
            assert_eq!(restored_a, cp_a);
            assert_eq!(restored_b, cp_b);
            assert_ne!(restored_a, restored_b);
        }

        #[test]
        fn checkpoint_json_is_compact_object() {
            // Sanity-check the wire format: must be a JSON object (not array or scalar).
            let cp = make_cp("main", 1);
            let json = serde_json::to_string(&cp).unwrap();
            assert!(json.starts_with('{') && json.ends_with('}'));
        }

        #[tokio::test]
        async fn replay_safe_restoration_skips_already_seen_ledgers() {
            // Simulate: checkpoint serialized at ledger 5, then deserialized on restart.
            // Worker must skip events at or below ledger 5.
            let original = make_cp("main", 5);
            let json = serde_json::to_string(&original).unwrap();
            let restored: Checkpoint = serde_json::from_str(&json).unwrap();

            let source = VecSource::new(vec![
                raw_event(3), // behind checkpoint — must skip
                raw_event(5), // equal to checkpoint — must skip
                raw_event(6), // ahead — must process
            ]);
            let sink = MemorySink::default();
            let mut worker = IngestWorker::new(WorkerConfig::default(), source, sink)
                .with_checkpoint(restored);

            let stats = worker.run_once().await.unwrap();

            assert_eq!(stats.skipped, 2, "ledgers 3 and 5 must be skipped");
            assert_eq!(stats.normalised, 1, "only ledger 6 must be processed");
            assert_eq!(worker.current_checkpoint().await.unwrap().last_ledger_seq, 6);
        }

        #[tokio::test]
        async fn replay_safe_restoration_at_zero_processes_all_events() {
            // A freshly-deserialized checkpoint with seq=0 must not skip any valid events.
            let cp: Checkpoint = serde_json::from_str(r#"{"stream":"main","last_ledger_seq":0}"#).unwrap();

            let source = VecSource::new(vec![raw_event(1), raw_event(2), raw_event(3)]);
            let sink = MemorySink::default();
            let mut worker = IngestWorker::new(WorkerConfig::default(), source, sink)
                .with_checkpoint(cp);

            let stats = worker.run_once().await.unwrap();

            assert_eq!(stats.skipped, 0);
            assert_eq!(stats.normalised, 3);
        }

        #[tokio::test]
        async fn checkpoint_not_regressed_after_all_events_skipped() {
            // If every incoming event is behind the serialized checkpoint, the
            // checkpoint value must remain unchanged (no regression).
            let original = make_cp("main", 100);
            let json = serde_json::to_string(&original).unwrap();
            let restored: Checkpoint = serde_json::from_str(&json).unwrap();

            let source = VecSource::new(vec![raw_event(50), raw_event(99)]);
            let sink = MemorySink::default();
            let mut worker = IngestWorker::new(WorkerConfig::default(), source, sink)
                .with_checkpoint(restored);

            worker.run_once().await.unwrap();

            assert_eq!(worker.current_checkpoint().await.unwrap().last_ledger_seq, 100);
        }
    }
}
