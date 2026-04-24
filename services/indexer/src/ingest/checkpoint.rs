//! Checkpoint cursor persistence.
//!
//! The checkpoint records the last successfully processed ledger sequence so
//! the ingestion worker can resume from the correct position after a restart.

use anyhow::Context;
use sqlx::PgPool;

// ── Types ─────────────────────────────────────────────────────────────────────

/// A persisted ingestion checkpoint.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Checkpoint {
    /// Name of the ingestion stream (allows multiple independent workers).
    pub stream: String,
    /// Last ledger sequence that was fully processed and committed.
    pub last_ledger_seq: u32,
}

// ── Repository ────────────────────────────────────────────────────────────────

/// Load the current checkpoint for `stream`, returning `None` if no checkpoint
/// exists yet (i.e. first run).
pub async fn load(db: &PgPool, stream: &str) -> anyhow::Result<Option<Checkpoint>> {
    let row = sqlx::query!(
        r#"
        SELECT last_ledger_seq
        FROM ingest_checkpoints
        WHERE stream = $1
        "#,
        stream
    )
    .fetch_optional(db)
    .await
    .context("load checkpoint")?;

    Ok(row.map(|r| Checkpoint {
        stream: stream.to_owned(),
        last_ledger_seq: r.last_ledger_seq as u32,
    }))
}

/// Persist (upsert) a checkpoint.
pub async fn save(db: &PgPool, checkpoint: &Checkpoint) -> anyhow::Result<()> {
    sqlx::query!(
        r#"
        INSERT INTO ingest_checkpoints (stream, last_ledger_seq, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (stream)
        DO UPDATE SET last_ledger_seq = EXCLUDED.last_ledger_seq,
                      updated_at      = EXCLUDED.updated_at
        "#,
        checkpoint.stream,
        checkpoint.last_ledger_seq as i64,
    )
    .execute(db)
    .await
    .context("save checkpoint")?;

    Ok(())
}

// ── In-memory stub (used in unit tests) ──────────────────────────────────────

/// A simple in-memory checkpoint store for unit testing without a real DB.
#[derive(Debug, Default)]
pub struct MemoryCheckpointStore {
    inner: std::collections::HashMap<String, u32>,
}

impl MemoryCheckpointStore {
    pub fn load(&self, stream: &str) -> Option<Checkpoint> {
        self.inner.get(stream).map(|&seq| Checkpoint {
            stream: stream.to_owned(),
            last_ledger_seq: seq,
        })
    }

    pub fn save(&mut self, checkpoint: &Checkpoint) {
        self.inner
            .insert(checkpoint.stream.clone(), checkpoint.last_ledger_seq);
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn memory_store_returns_none_on_first_run() {
        let store = MemoryCheckpointStore::default();
        assert!(store.load("main").is_none());
    }

    #[test]
    fn memory_store_roundtrip() {
        let mut store = MemoryCheckpointStore::default();
        let cp = Checkpoint {
            stream: "main".into(),
            last_ledger_seq: 42,
        };
        store.save(&cp);
        let loaded = store.load("main").unwrap();
        assert_eq!(loaded.last_ledger_seq, 42);
    }

    #[test]
    fn memory_store_upserts() {
        let mut store = MemoryCheckpointStore::default();
        store.save(&Checkpoint { stream: "main".into(), last_ledger_seq: 10 });
        store.save(&Checkpoint { stream: "main".into(), last_ledger_seq: 20 });
        assert_eq!(store.load("main").unwrap().last_ledger_seq, 20);
    }

    #[test]
    fn memory_store_independent_streams() {
        let mut store = MemoryCheckpointStore::default();
        store.save(&Checkpoint { stream: "a".into(), last_ledger_seq: 1 });
        store.save(&Checkpoint { stream: "b".into(), last_ledger_seq: 99 });
        assert_eq!(store.load("a").unwrap().last_ledger_seq, 1);
        assert_eq!(store.load("b").unwrap().last_ledger_seq, 99);
    }
}
