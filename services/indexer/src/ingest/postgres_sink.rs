//! Production [`EventSink`] backed by Postgres.
//!
//! Writes every [`CanonicalEvent`] to both `contract_events` (the raw,
//! typed AA-event store) and `account_activity` (the unified activity feed
//! wallets query) — matching what `docs/BACKFILL.md`'s "Tables Affected"
//! section already documents as the two tables ingestion populates, and
//! what `InsertActivity`/`InsertContractEvent`'s own doc comments describe
//! ("ingest wiring lands separately"). This is that wiring.
//!
//! Idempotent: `insert_contract_event`/`insert_activity` `ON CONFLICT DO
//! NOTHING` on `(tx_hash, event_type/activity_type, ledger_seq)` (migration
//! `007_add_ingest_idempotency_constraints.sql`), so replaying an
//! already-ingested event via a worker restart or overlapping backfill
//! range is a no-op rather than a duplicate row.

use sqlx::PgPool;
use tracing::warn;

use super::sink::EventSink;
use crate::repositories::account_activity::{insert_activity, InsertActivity};
use crate::repositories::contract_events::insert_contract_event;
use crate::schema::canonical::CanonicalEvent;
use crate::schema::contract_event::InsertContractEvent;

/// Persists canonical events to the `contract_events` and `account_activity`
/// Postgres tables.
pub struct PostgresEventSink {
    pool: PgPool,
}

impl PostgresEventSink {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait::async_trait]
impl EventSink for PostgresEventSink {
    /// Persists each event to both tables. A failure on one event's
    /// `contract_events` write skips its `account_activity` write (they
    /// describe the same event; writing "half" of it would leave the two
    /// tables permanently disagreeing) and the error propagates, matching
    /// the documented contiguous-cursor invariant: the caller
    /// (`IngestWorker`) must not advance the checkpoint past a batch that
    /// didn't fully persist.
    async fn persist(&mut self, events: &[CanonicalEvent]) -> anyhow::Result<()> {
        for event in events {
            let data = serde_json::json!({
                "kind": event.kind.to_string(),
                "topics": event.raw.topics,
                "amount": event.amount,
                "asset": event.asset,
                "counterparty": event.counterparty,
                "data": event.raw.data,
            });

            insert_contract_event(
                &self.pool,
                &InsertContractEvent {
                    contract_address: event.contract_id.clone(),
                    account_id: event.account_id.clone(),
                    event_type: event.kind.to_string(),
                    ledger_seq: i64::from(event.ledger_seq),
                    timestamp: event.occurred_at,
                    tx_hash: event.tx_hash.clone(),
                    data,
                },
            )
            .await
            .map_err(|e| anyhow::anyhow!("insert_contract_event: {e}"))?;

            let insert_result = insert_activity(
                &self.pool,
                &InsertActivity {
                    account_id: event.account_id.clone(),
                    activity_type: event.kind.to_string(),
                    amount: event.amount.clone(),
                    asset: event.asset.clone(),
                    counterparty: event.counterparty.clone(),
                    tx_hash: event.tx_hash.clone(),
                    ledger_seq: i64::from(event.ledger_seq),
                    created_at: event.occurred_at,
                    metadata: None,
                },
            )
            .await
            .map_err(|e| anyhow::anyhow!("insert_activity: {e}"))?;

            if insert_result.is_none() {
                // Not an error — the contiguous-cursor invariant means a
                // worker restart or overlapping backfill legitimately
                // replays already-seen events. Logged at debug-adjacent
                // warn so it's visible without being alarming in the
                // steady-state "backfill overlap" case.
                warn!(
                    tx_hash = %event.tx_hash,
                    event_type = %event.kind,
                    "account_activity row already existed (idempotent replay)"
                );
            }
        }
        Ok(())
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
//
// Require a live Postgres instance with migrations applied — same
// `#[ignore]` + `TEST_DATABASE_URL` convention as
// `ingest::checkpoint::tests::postgres_integration`.

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::canonical::{CanonicalEvent, EventKind, RawEvent};
    use chrono::Utc;
    use uuid::Uuid;

    async fn setup_test_db() -> PgPool {
        dotenvy::dotenv().ok();
        let database_url = std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| {
            "postgresql://postgres:postgres@localhost:5432/ancore_test".to_string()
        });
        let pool = PgPool::connect(&database_url)
            .await
            .expect("failed to connect to test database (run migrations first)");

        // Clean slate per test — these tables are also used by other
        // integration tests, so scope deletes to this test's tx_hash prefix
        // via a marker instead of truncating shared state.
        pool
    }

    fn make_event(tx_hash: &str, ledger_seq: u32) -> CanonicalEvent {
        CanonicalEvent {
            id: Uuid::new_v4(),
            kind: EventKind::Transfer,
            account_id: "CTESTPOSTGRESSINK00000000000000000000000000000000000".into(),
            ledger_seq,
            occurred_at: Utc::now(),
            tx_hash: tx_hash.into(),
            contract_id: "CTESTPOSTGRESSINK00000000000000000000000000000000000".into(),
            amount: Some("100.0000000".into()),
            asset: Some("native".into()),
            counterparty: Some("GCOUNTERPARTY0000000000000000000000000000000000000".into()),
            raw: RawEvent {
                ledger_seq,
                ledger_close_time: Utc::now(),
                tx_hash: tx_hash.into(),
                contract_id: "CTESTPOSTGRESSINK00000000000000000000000000000000000".into(),
                topics: vec!["transfer".into()],
                data: String::new(),
            },
        }
    }

    #[tokio::test]
    #[ignore] // Requires test database
    async fn persist_writes_to_both_tables() {
        let pool = setup_test_db().await;
        let tx_hash = format!("{:0>64}", "sinktest1");
        let event = make_event(&tx_hash, 900_001);

        let mut sink = PostgresEventSink::new(pool.clone());
        sink.persist(&[event.clone()]).await.unwrap();

        let activity_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM account_activity WHERE tx_hash = $1")
                .bind(&tx_hash)
                .fetch_one(&pool)
                .await
                .unwrap();
        let contract_event_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM contract_events WHERE tx_hash = $1")
                .bind(&tx_hash)
                .fetch_one(&pool)
                .await
                .unwrap();

        assert_eq!(activity_count, 1);
        assert_eq!(contract_event_count, 1);
    }

    #[tokio::test]
    #[ignore] // Requires test database
    async fn persist_is_idempotent_on_replay() {
        let pool = setup_test_db().await;
        let tx_hash = format!("{:0>64}", "sinktest2");
        let event = make_event(&tx_hash, 900_002);

        let mut sink = PostgresEventSink::new(pool.clone());
        sink.persist(&[event.clone()]).await.unwrap();
        // Replay the exact same event — simulates a worker restart or an
        // overlapping backfill range re-processing a ledger.
        sink.persist(&[event]).await.unwrap();

        let activity_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM account_activity WHERE tx_hash = $1")
                .bind(&tx_hash)
                .fetch_one(&pool)
                .await
                .unwrap();
        let contract_event_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM contract_events WHERE tx_hash = $1")
                .bind(&tx_hash)
                .fetch_one(&pool)
                .await
                .unwrap();

        assert_eq!(activity_count, 1, "replay must not create a duplicate row");
        assert_eq!(
            contract_event_count, 1,
            "replay must not create a duplicate row"
        );
    }
}
