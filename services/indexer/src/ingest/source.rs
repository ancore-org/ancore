//! Event source abstraction.
//!
//! In production this would be backed by a Stellar Horizon/RPC streaming
//! client.  For tests a simple [`VecSource`] is provided.

use crate::schema::canonical::RawEvent;

/// Trait for anything that can supply raw events to the ingestion worker.
#[async_trait::async_trait]
pub trait EventSource: Send {
    /// Fetch up to `limit` events with `ledger_seq > after_ledger`.
    async fn fetch(&mut self, after_ledger: u32, limit: usize) -> anyhow::Result<Vec<RawEvent>>;
}

// ── In-memory source (tests) ──────────────────────────────────────────────────

/// A one-shot source backed by a pre-loaded `Vec`.
/// Drains the vector on the first call; subsequent calls return empty.
pub struct VecSource {
    events: Vec<RawEvent>,
}

impl VecSource {
    pub fn new(events: Vec<RawEvent>) -> Self {
        Self { events }
    }
}

#[async_trait::async_trait]
impl EventSource for VecSource {
    async fn fetch(&mut self, _after_ledger: u32, _limit: usize) -> anyhow::Result<Vec<RawEvent>> {
        Ok(std::mem::take(&mut self.events))
    }
}
