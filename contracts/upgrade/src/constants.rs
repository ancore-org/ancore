#![allow(dead_code)]

//! Compile-time and runtime constants for the UpgradeGovernor contract.
//!
//! Centralizing constants makes tuning and auditing easier.

use soroban_sdk::{Address, BytesN, Env, Symbol, Vec};

use crate::{ContractValidation, DataKey, MultisigConfig, Proposal, UpgradeHistory, UpgradeError};

// TTL constants (in ledgers, assuming 5-second ledger close)
pub const INSTANCE_BUMP_AMOUNT: u32 = 30 * 17280; // ~30 days
pub const INSTANCE_BUMP_THRESHOLD: u32 = 15 * 17280; // ~15 days
pub const PERSISTENT_BUMP_AMOUNT: u32 = 30 * 17280;
pub const PERSISTENT_BUMP_THRESHOLD: u32 = 15 * 17280;

// Proposal defaults
pub const DEFAULT_TIMELOCK_DELAY: u64 = 24 * 60 * 60; // 24 hours
pub const DEFAULT_PROPOSAL_EXPIRATION: u64 = 7 * 24 * 60 * 60; // 7 days
pub const MAX_PROPOSAL_DESCRIPTION_LENGTH: u32 = 1024;
pub const MAX_METADATA_LENGTH: u32 = 4096;

// Validation defaults
pub const DEFAULT_MIN_WASM_SIZE: u32 = 1024;
pub const DEFAULT_MAX_WASM_SIZE: u32 = 10 * 1024 * 1024; // 10 MB

// Multisig defaults
pub const DEFAULT_MULTISIG_THRESHOLD: u32 = 2;
pub const MAX_MULTISIG_SIGNERS: u32 = 50;

// History retention
pub const HISTORY_RETENTION_DAYS: u64 = 365; // 1 year
pub const HISTORY_PRUNE_BATCH_SIZE: u32 = 100;

/// Well-known event topic symbols.
pub mod topic {
    use soroban_sdk::{Env, Symbol};

    pub fn proposed(env: &Env) -> Symbol {
        Symbol::new(env, "proposed")
    }
    pub fn executed(env: &Env) -> Symbol {
        Symbol::new(env, "executed")
    }
    pub fn cancelled(env: &Env) -> Symbol {
        Symbol::new(env, "cancelled")
    }
    pub fn timelock_updated(env: &Env) -> Symbol {
        Symbol::new(env, "timelock_updated")
    }
    pub fn emergency_paused(env: &Env) -> Symbol {
        Symbol::new(env, "emergency_paused")
    }
    pub fn emergency_resumed(env: &Env) -> Symbol {
        Symbol::new(env, "emergency_resumed")
    }
    pub fn owner_updated(env: &Env) -> Symbol {
        Symbol::new(env, "owner_updated")
    }
    pub fn multisig_updated(env: &Env) -> Symbol {
        Symbol::new(env, "multisig_updated")
    }
    pub fn signature_submitted(env: &Env) -> Symbol {
        Symbol::new(env, "signature_submitted")
    }
    pub fn upgrade_validated(env: &Env) -> Symbol {
        Symbol::new(env, "upgrade_validated")
    }
    pub fn migrated(env: &Env) -> Symbol {
        Symbol::new(env, "migrated")
    }
}

/// Well-known storage key prefixes.
pub mod keys {
    use soroban_sdk::Symbol;

    pub const PREFIX_OWNER: &str = "owner";
    pub const PREFIX_TIMELOCK: &str = "timelock";
    pub const PREFIX_TARGET: &str = "target";
    pub const PREFIX_PROPOSAL: &str = "proposal";
    pub const PREFIX_HISTORY: &str = "history";
    pub const PREFIX_VALIDATION: &str = "validation";
    pub const PREFIX_MULTISIG: &str = "multisig";
    pub const PREFIX_VERSION: &str = "version";
}

/// Compute a proposal data key from proposal ID.
pub fn proposal_key(env: &Env, proposal_id: u32) -> crate::DataKey {
    crate::DataKey::Proposal(proposal_id)
}

/// Compute a history entry key from history ID.
pub fn history_key(env: &Env, history_id: u32) -> crate::DataKey {
    crate::DataKey::UpgradeHistory(history_id)
}

/// Validate that a WASM hash is non-zero.
pub fn is_non_zero_hash(wasm_hash: &BytesN<32>) -> bool {
    wasm_hash != &BytesN::from_array(&unsafe { std::ptr::null::<()>() as *const _ }, &[0u8; 32])
}

/// Clamp a value between min and max.
pub fn clamp_u64(value: u64, min: u64, max: u64) -> u64 {
    if value < min {
        min
    } else if value > max {
        max
    } else {
        value
    }
}

/// Check if a timestamp is within the proposal window.
pub fn is_within_proposal_window(execute_after: u64, expires_at: u64, now: u64) -> bool {
    now >= execute_after && now <= expires_at
}

/// Create a default proposal with sensible defaults.
pub fn default_proposal(env: &Env, wasm_hash: BytesN<32>) -> Result<Proposal, UpgradeError> {
    let now = env.ledger().timestamp();
    let timelock: u64 = env
        .storage()
        .instance()
        .get(&DataKey::TimelockDelay)
        .unwrap_or(DEFAULT_TIMELOCK_DELAY);
    let expiration: u64 = env
        .storage()
        .instance()
        .get(&DataKey::ProposalExpirationWindow)
        .unwrap_or(DEFAULT_PROPOSAL_EXPIRATION);

    let execute_after = now
        .checked_add(timelock)
        .ok_or(UpgradeError::ArithmeticOverflow)?;
    let expires_at = now
        .checked_add(expiration)
        .ok_or(UpgradeError::ArithmeticOverflow)?;

    Ok(Proposal {
        id: 0,
        wasm_hash,
        proposed_at: now,
        execute_after,
        expires_at,
        executed: false,
        cancelled: false,
        proposer: crate::UpgradeGovernor::require_owner(env.clone())?,
        description: None,
        metadata: None,
    })
}

/// Create default contract validation rules.
pub fn default_validation(env: &Env) -> ContractValidation {
    ContractValidation {
        min_wasm_size: DEFAULT_MIN_WASM_SIZE,
        max_wasm_size: DEFAULT_MAX_WASM_SIZE,
        required_exports: vec![
            "upgrade".to_string(),
            "get_version".to_string(),
            "initialize".to_string(),
        ],
        forbidden_imports: Vec::new(env),
    }
}

/// Create default multisig configuration.
pub fn default_multisig(env: &Env) -> MultisigConfig {
    let signers = Vec::new(env);
    MultisigConfig {
        threshold: DEFAULT_MULTISIG_THRESHOLD,
        signers,
        next_nonce: 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{BytesN, Env};

    #[test]
    fn test_clamp_u64() {
        assert_eq!(clamp_u64(5, 10, 20), 10);
        assert_eq!(clamp_u64(25, 10, 20), 20);
        assert_eq!(clamp_u64(15, 10, 20), 15);
    }

    #[test]
    fn test_is_within_proposal_window() {
        assert!(is_within_proposal_window(1000, 2000, 1500));
        assert!(!is_within_proposal_window(1000, 2000, 500));
        assert!(!is_within_proposal_window(1000, 2000, 2500));
    }

    #[test]
    fn test_default_validation_has_required_exports() {
        let env = Env::default();
        let v = default_validation(&env);
        assert!(v.required_exports.contains(&"upgrade".to_string()));
    }

    #[test]
    fn test_proposal_key_roundtrip() {
        let env = Env::default();
        let key = proposal_key(&env, 42);
        match key {
            crate::DataKey::Proposal(id) => assert_eq!(id, 42),
            _ => panic!("unexpected key type"),
        }
    }
}