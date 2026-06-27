use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Contract event types emitted by the account contract.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContractEventType {
    Initialized,
    Executed,
    SessionKeyAdded,
    SessionKeyRevoked,
    Upgraded,
}

impl ContractEventType {
    pub fn as_str(&self) -> &'static str {
        match self {
            ContractEventType::Initialized => "initialized",
            ContractEventType::Executed => "executed",
            ContractEventType::SessionKeyAdded => "session_key_added",
            ContractEventType::SessionKeyRevoked => "session_key_revoked",
            ContractEventType::Upgraded => "upgraded",
        }
    }
}

impl std::fmt::Display for ContractEventType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

impl std::str::FromStr for ContractEventType {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "initialized" => Ok(ContractEventType::Initialized),
            "executed" => Ok(ContractEventType::Executed),
            "session_key_added" => Ok(ContractEventType::SessionKeyAdded),
            "session_key_revoked" => Ok(ContractEventType::SessionKeyRevoked),
            "upgraded" => Ok(ContractEventType::Upgraded),
            _ => Err(()),
        }
    }
}

/// A decoded contract event from the account contract.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractEvent {
    pub id: Uuid,
    pub contract_address: String,
    pub event_type: String,
    pub ledger_seq: i64,
    pub timestamp: DateTime<Utc>,
    pub tx_hash: String,
    pub data: serde_json::Value,
}

/// Parameters for inserting a new contract event.
#[derive(Debug, Clone)]
pub struct InsertContractEvent {
    pub contract_address: String,
    pub event_type: String,
    pub ledger_seq: i64,
    pub timestamp: DateTime<Utc>,
    pub tx_hash: String,
    pub data: serde_json::Value,
}

/// Filters for querying contract events.
#[derive(Debug, Clone, Default)]
pub struct ContractEventFilter {
    pub contract_address: Option<String>,
    pub event_type: Option<String>,
    pub ledger_min: Option<i64>,
    pub ledger_max: Option<i64>,
    pub limit: Option<u32>,
    pub offset: Option<u64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn contract_event_type_display() {
        assert_eq!(ContractEventType::Initialized.to_string(), "initialized");
        assert_eq!(ContractEventType::Executed.to_string(), "executed");
        assert_eq!(
            ContractEventType::SessionKeyAdded.to_string(),
            "session_key_added"
        );
        assert_eq!(
            ContractEventType::SessionKeyRevoked.to_string(),
            "session_key_revoked"
        );
        assert_eq!(ContractEventType::Upgraded.to_string(), "upgraded");
    }

    #[test]
    fn contract_event_type_from_str() {
        assert_eq!(
            "initialized".parse::<ContractEventType>().unwrap(),
            ContractEventType::Initialized
        );
        assert_eq!(
            "session_key_added".parse::<ContractEventType>().unwrap(),
            ContractEventType::SessionKeyAdded
        );
        assert!("invalid".parse::<ContractEventType>().is_err());
    }

    #[test]
    fn contract_event_type_serde_roundtrip() {
        let kinds = vec![
            ContractEventType::Initialized,
            ContractEventType::Executed,
            ContractEventType::SessionKeyAdded,
            ContractEventType::SessionKeyRevoked,
            ContractEventType::Upgraded,
        ];
        for kind in kinds {
            let json = serde_json::to_string(&kind).unwrap();
            let deserialized: ContractEventType = serde_json::from_str(&json).unwrap();
            assert_eq!(deserialized, kind);
        }
    }
}
