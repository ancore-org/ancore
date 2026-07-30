#![allow(dead_code)]

//! Storage management utilities for the UpgradeGovernor contract.
//!
//! This module provides helper functions for common storage operations,
//! TTL management, and data migration patterns.

use soroban_sdk::{Address, BytesN, Env};

use crate::{Proposal, UpgradeHistory, ContractValidation, DataKey, MultisigConfig, UpgradeError};

const DEFAULT_BUMP_THRESHOLD: u32 = 15 * 17280; // 15 days in ledgers
const DEFAULT_BUMP_AMOUNT: u32 = 30 * 17280; // 30 days in ledgers

/// Extend TTL for instance storage with default values.
pub fn extend_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(DEFAULT_BUMP_THRESHOLD, DEFAULT_BUMP_AMOUNT);
}

/// Extend TTL for persistent storage with default values.
pub fn extend_persistent(env: &Env) {
    env.storage()
        .persistent()
        .extend_ttl(DEFAULT_BUMP_THRESHOLD, DEFAULT_BUMP_AMOUNT);
}

/// Store a proposal with automatic TTL extension.
pub fn store_proposal(env: &Env, proposal: &Proposal) -> Result<(), UpgradeError> {
    env.storage()
        .instance()
        .set(&DataKey::Proposal(proposal.id), proposal);
    extend_instance(env);
    Ok(())
}

/// Retrieve a proposal by ID.
pub fn load_proposal(env: &Env, proposal_id: u32) -> Result<Option<Proposal>, UpgradeError> {
    Ok(env.storage().instance().get(&DataKey::Proposal(proposal_id)))
}

/// Delete a proposal (used for cleanup after execution/cancellation).
pub fn delete_proposal(env: &Env, proposal_id: u32) -> Result<(), UpgradeError> {
    env.storage()
        .instance()
        .remove(&DataKey::Proposal(proposal_id));
    Ok(())
}

/// Store upgrade history entry.
pub fn store_history(env: &Env, history: &UpgradeHistory) -> Result<u32, UpgradeError> {
    let history_id: u32 = env
        .storage()
        .instance()
        .get(&DataKey::NextHistoryId)
        .unwrap_or(1);

    env.storage()
        .instance()
        .set(&DataKey::UpgradeHistory(history_id), history);

    let next_id = history_id
        .checked_add(1)
        .ok_or(UpgradeError::ArithmeticOverflow)?;
    env.storage()
        .instance()
        .set(&DataKey::NextHistoryId, &next_id);

    extend_instance(env);
    Ok(history_id)
}

/// Get the next proposal ID without incrementing.
pub fn peek_next_proposal_id(env: &Env) -> Result<u32, UpgradeError> {
    Ok(env.storage()
        .instance()
        .get(&DataKey::NextProposalId)
        .unwrap_or(1))
}

/// Increment and return the next proposal ID.
pub fn increment_proposal_id(env: &Env) -> Result<u32, UpgradeError> {
    let current: u32 = env
        .storage()
        .instance()
        .get(&DataKey::NextProposalId)
        .unwrap_or(1);
    let next = current
        .checked_add(1)
        .ok_or(UpgradeError::ArithmeticOverflow)?;
    env.storage()
        .instance()
        .set(&DataKey::NextProposalId, &next);
    Ok(current)
}

/// Check if a proposal exists and is in a valid state for execution.
pub fn validate_proposal_executable(env: &Env, proposal_id: u32) -> Result<Proposal, UpgradeError> {
    let proposal = env
        .storage()
        .instance()
        .get(&DataKey::Proposal(proposal_id))
        .ok_or(UpgradeError::ProposalNotFound)?;

    if proposal.executed {
        return Err(UpgradeError::ProposalAlreadyExecuted);
    }
    if proposal.cancelled {
        return Err(UpgradeError::ProposalAlreadyCancelled);
    }

    let current_timestamp = env.ledger().timestamp();
    if current_timestamp < proposal.execute_after {
        return Err(UpgradeError::TimelockNotElapsed);
    }
    if current_timestamp > proposal.expires_at {
        return Err(UpgradeError::ProposalExpired);
    }

    Ok(proposal)
}

/// Initialize default contract validation rules.
pub fn init_default_validation(env: &Env) -> Result<(), UpgradeError> {
    let validation = ContractValidation {
        min_wasm_size: 1024,
        max_wasm_size: 10 * 1024 * 1024, // 10 MB
        required_exports: vec![
            "upgrade".to_string(),
            "get_version".to_string(),
            "initialize".to_string(),
        ],
        forbidden_imports: vec![],
    };

    env.storage()
        .instance()
        .set(&DataKey::ContractValidation, &validation);

    extend_instance(env);
    Ok(())
}

/// Get current contract validation rules.
pub fn get_validation(env: &Env) -> ContractValidation {
    env.storage()
        .instance()
        .get(&DataKey::ContractValidation)
        .unwrap_or(ContractValidation {
            min_wasm_size: 0,
            max_wasm_size: u32::MAX,
            required_exports: Vec::new(env),
            forbidden_imports: Vec::new(env),
        })
}

/// Initialize multisig configuration.
pub fn init_multisig(env: &Env, threshold: u32, signers: Vec<Address>) -> Result<(), UpgradeError> {
    if threshold == 0 {
        return Err(UpgradeError::InvalidThreshold);
    }
    if signers.len() > 50 {
        return Err(UpgradeError::InvalidSigner);
    }

    let config = MultisigConfig {
        threshold,
        signers,
        next_nonce: 0,
    };

    env.storage()
        .instance()
        .set(&DataKey::MultisigConfig, &config);

    extend_instance(env);
    Ok(())
}

/// Get multisig configuration.
pub fn get_multisig(env: &Env) -> Option<MultisigConfig> {
    env.storage().instance().get(&DataKey::MultisigConfig)
}

/// Scan all proposals and return IDs matching a predicate.
pub fn scan_proposals<F>(env: &Env, mut predicate: F) -> Vec<u32>
where
    F: FnMut(&Proposal) -> bool,
{
    let next_id: u32 = env
        .storage()
        .instance()
        .get(&DataKey::NextProposalId)
        .unwrap_or(1);

    let mut matches = Vec::new(env);
    for id in 1..next_id {
        if let Some(proposal) = env.storage().instance().get(&DataKey::Proposal(id)) {
            if predicate(&proposal) {
                matches.push_back(id);
            }
        }
    }
    matches
}

/// Batch remove expired proposals older than the given timestamp.
pub fn cleanup_expired_proposals(env: &Env, older_than: u64) -> Result<u32, UpgradeError> {
    let next_id: u32 = env
        .storage()
        .instance()
        .get(&DataKey::NextProposalId)
        .unwrap_or(1);

    let mut removed = 0;
    for id in 1..next_id {
        if let Some(proposal) = env.storage().instance().get(&DataKey::Proposal(id)) {
            if proposal.expires_at < older_than && !proposal.executed && !proposal.cancelled {
                env.storage()
                    .instance()
                    .remove(&DataKey::Proposal(id));
                removed += 1;
            }
        }
    }

    extend_instance(env);
    Ok(removed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{Address, BytesN, Env};

    #[test]
    fn test_store_and_load_proposal() {
        let env = Env::default();
        let proposal = Proposal {
            id: 1,
            wasm_hash: BytesN::from_array(&env, &[1u8; 32]),
            proposed_at: 1000,
            execute_after: 1010,
            expires_at: 2000,
            executed: false,
            cancelled: false,
            proposer: Address::generate(&env),
            description: None,
            metadata: None,
        };

        store_proposal(&env, &proposal).unwrap();
        let loaded = load_proposal(&env, 1).unwrap().unwrap();
        assert_eq!(loaded.id, proposal.id);
    }

    #[test]
    fn test_cleanup_expired_proposals() {
        let env = Env::default();
        let proposal = Proposal {
            id: 1,
            wasm_hash: BytesN::from_array(&env, &[1u8; 32]),
            proposed_at: 1000,
            execute_after: 1010,
            expires_at: 1500,
            executed: false,
            cancelled: false,
            proposer: Address::generate(&env),
            description: None,
            metadata: None,
        };

        store_proposal(&env, &proposal).unwrap();
        let removed = cleanup_expired_proposals(&env, 2000).unwrap();
        // Proposal expired at 1500, older_than=2000 should remove it
        assert_eq!(removed, 1);
    }

    #[test]
    fn test_init_default_validation() {
        let env = Env::default();
        init_default_validation(&env).unwrap();
        let validation = get_validation(&env);
        assert_eq!(validation.min_wasm_size, 1024);
        assert!(validation.required_exports.contains(&"upgrade".to_string()));
    }
}