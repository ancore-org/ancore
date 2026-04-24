//! Canonical internal event schema.
//!
//! Raw contract events from the Stellar network are normalised into
//! [`CanonicalEvent`] before being persisted or forwarded downstream.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Event kind ────────────────────────────────────────────────────────────────

/// High-level classification of a contract event.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EventKind {
    /// Native XLM or asset transfer between accounts.
    Transfer,
    /// Session key registered on an account contract.
    SessionKeyAdded,
    /// Session key revoked from an account contract.
    SessionKeyRevoked,
    /// Relayed transaction executed via the account contract.
    RelayExecuted,
    /// Any event that does not map to a known kind.
    Unknown,
}

impl std::fmt::Display for EventKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            EventKind::Transfer => "transfer",
            EventKind::SessionKeyAdded => "session_key_added",
            EventKind::SessionKeyRevoked => "session_key_revoked",
            EventKind::RelayExecuted => "relay_executed",
            EventKind::Unknown => "unknown",
        };
        write!(f, "{s}")
    }
}

// ── Raw event (source) ────────────────────────────────────────────────────────

/// A raw contract event as received from the Stellar horizon/RPC stream.
/// Fields mirror the Stellar contract event structure.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawEvent {
    /// Ledger sequence number the event was emitted in.
    pub ledger_seq: u32,
    /// Ledger close time (UTC).
    pub ledger_close_time: DateTime<Utc>,
    /// Transaction hash (hex-encoded, 64 chars).
    pub tx_hash: String,
    /// Contract address that emitted the event.
    pub contract_id: String,
    /// Event topic list (XDR base64-encoded SCVal entries).
    pub topics: Vec<String>,
    /// Event data payload (XDR base64-encoded SCVal).
    pub data: String,
}

// ── Canonical event ───────────────────────────────────────────────────────────

/// Normalised, internal representation of a contract event.
/// This is the schema written to the database and consumed by downstream services.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CanonicalEvent {
    /// Stable internal identifier (UUIDv4).
    pub id: Uuid,
    /// Classified event kind.
    pub kind: EventKind,
    /// Primary account address this event is attributed to.
    pub account_id: String,
    /// Ledger sequence number.
    pub ledger_seq: u32,
    /// Ledger close time (UTC) — used as the canonical event timestamp.
    pub occurred_at: DateTime<Utc>,
    /// Transaction hash.
    pub tx_hash: String,
    /// Originating contract address.
    pub contract_id: String,
    /// Optional transfer amount (string to preserve precision).
    pub amount: Option<String>,
    /// Optional asset identifier (e.g. "native" or "USDC:G...").
    pub asset: Option<String>,
    /// Optional counterparty address (recipient / revoker / etc.).
    pub counterparty: Option<String>,
    /// Full raw event preserved for auditability.
    pub raw: RawEvent,
}

impl CanonicalEvent {
    /// Derive the activity_type string used in the `account_activity` table.
    pub fn activity_type(&self) -> String {
        self.kind.to_string()
    }
}

// ── Normaliser ────────────────────────────────────────────────────────────────

/// Errors that can occur during event normalisation.
#[derive(Debug, thiserror::Error)]
pub enum NormaliseError {
    #[error("Missing required field: {0}")]
    MissingField(&'static str),
    #[error("Malformed field '{field}': {reason}")]
    MalformedField { field: &'static str, reason: String },
}

/// Normalise a [`RawEvent`] into a [`CanonicalEvent`].
///
/// The function is intentionally lenient: unknown event shapes are mapped to
/// [`EventKind::Unknown`] rather than returning an error, so the pipeline
/// never stalls on unrecognised events.
pub fn normalise(raw: RawEvent) -> Result<CanonicalEvent, NormaliseError> {
    if raw.tx_hash.is_empty() {
        return Err(NormaliseError::MissingField("tx_hash"));
    }
    if raw.contract_id.is_empty() {
        return Err(NormaliseError::MissingField("contract_id"));
    }

    let kind = classify_event(&raw.topics);

    // The primary account is the contract that emitted the event.
    // Downstream enrichment can override this for transfer events.
    let account_id = raw.contract_id.clone();

    // Extract optional transfer fields from topics / data heuristically.
    // Real implementations would decode XDR; here we use positional conventions.
    let (amount, asset, counterparty) = extract_transfer_fields(&kind, &raw.topics);

    Ok(CanonicalEvent {
        id: Uuid::new_v4(),
        kind,
        account_id,
        ledger_seq: raw.ledger_seq,
        occurred_at: raw.ledger_close_time,
        tx_hash: raw.tx_hash.clone(),
        contract_id: raw.contract_id.clone(),
        amount,
        asset,
        counterparty,
        raw,
    })
}

/// Classify an event based on its topic list.
///
/// Convention (mirrors Soroban contract SDK event emission):
///   topics[0] = event name / discriminant
fn classify_event(topics: &[String]) -> EventKind {
    match topics.first().map(String::as_str) {
        Some("transfer") => EventKind::Transfer,
        Some("session_key_added") | Some("add_session_key") => EventKind::SessionKeyAdded,
        Some("session_key_revoked") | Some("revoke_session_key") => EventKind::SessionKeyRevoked,
        Some("relay_executed") | Some("execute") => EventKind::RelayExecuted,
        _ => EventKind::Unknown,
    }
}

/// Extract transfer-related fields from topics using positional convention:
///   topics[1] = asset, topics[2] = counterparty, data = amount
fn extract_transfer_fields(
    kind: &EventKind,
    topics: &[String],
) -> (Option<String>, Option<String>, Option<String>) {
    if *kind != EventKind::Transfer {
        return (None, None, topics.get(1).cloned());
    }
    let asset = topics.get(1).cloned();
    let counterparty = topics.get(2).cloned();
    let amount = topics.get(3).cloned();
    (amount, asset, counterparty)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn make_raw(topics: Vec<&str>) -> RawEvent {
        RawEvent {
            ledger_seq: 100,
            ledger_close_time: Utc.with_ymd_and_hms(2024, 6, 1, 12, 0, 0).unwrap(),
            tx_hash: "a".repeat(64),
            contract_id: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN".to_string(),
            topics: topics.iter().map(|s| s.to_string()).collect(),
            data: String::new(),
        }
    }

    #[test]
    fn normalise_transfer_event() {
        let raw = RawEvent {
            topics: vec![
                "transfer".into(),
                "native".into(),
                "GBXXX".into(),
                "100.0000000".into(),
            ],
            ..make_raw(vec![])
        };
        let ev = normalise(raw).unwrap();
        assert_eq!(ev.kind, EventKind::Transfer);
        assert_eq!(ev.asset.as_deref(), Some("native"));
        assert_eq!(ev.counterparty.as_deref(), Some("GBXXX"));
        assert_eq!(ev.amount.as_deref(), Some("100.0000000"));
    }

    #[test]
    fn normalise_session_key_added() {
        let ev = normalise(make_raw(vec!["session_key_added", "GBSESSIONKEY"])).unwrap();
        assert_eq!(ev.kind, EventKind::SessionKeyAdded);
        assert_eq!(ev.activity_type(), "session_key_added");
    }

    #[test]
    fn normalise_unknown_event() {
        let ev = normalise(make_raw(vec!["some_future_event"])).unwrap();
        assert_eq!(ev.kind, EventKind::Unknown);
    }

    #[test]
    fn normalise_rejects_empty_tx_hash() {
        let mut raw = make_raw(vec!["transfer"]);
        raw.tx_hash = String::new();
        assert!(matches!(normalise(raw), Err(NormaliseError::MissingField("tx_hash"))));
    }

    #[test]
    fn normalise_rejects_empty_contract_id() {
        let mut raw = make_raw(vec!["transfer"]);
        raw.contract_id = String::new();
        assert!(matches!(normalise(raw), Err(NormaliseError::MissingField("contract_id"))));
    }

    #[test]
    fn activity_type_string_matches_kind() {
        assert_eq!(EventKind::Transfer.to_string(), "transfer");
        assert_eq!(EventKind::RelayExecuted.to_string(), "relay_executed");
    }
}
