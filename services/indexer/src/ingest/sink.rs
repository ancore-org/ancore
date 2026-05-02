//! Event sink abstraction.
//!
//! In production this writes to the `account_activity` Postgres table.
//! For tests a [`MemorySink`] is provided.

use crate::schema::canonical::CanonicalEvent;

/// Trait for anything that can durably store canonical events.
#[async_trait::async_trait]
pub trait EventSink: Send {
    /// Persist a batch of canonical events atomically.
    async fn persist(&mut self, events: &[CanonicalEvent]) -> anyhow::Result<()>;
}

// ── In-memory sink (tests) ────────────────────────────────────────────────────

/// Accumulates persisted events in memory for assertion in tests.
#[derive(Debug, Default)]
pub struct MemorySink {
    pub events: Vec<CanonicalEvent>,
}

#[async_trait::async_trait]
impl EventSink for MemorySink {
    async fn persist(&mut self, events: &[CanonicalEvent]) -> anyhow::Result<()> {
        self.events.extend_from_slice(events);
        Ok(())
    }
}

// ── Failing sink (tests) ──────────────────────────────────────────────────────

/// A sink that always returns an error — used to test persist-failure paths.
pub struct FailingSink;

#[async_trait::async_trait]
impl EventSink for FailingSink {
    async fn persist(&mut self, _events: &[CanonicalEvent]) -> anyhow::Result<()> {
        Err(anyhow::anyhow!("simulated sink failure"))
    }
}
