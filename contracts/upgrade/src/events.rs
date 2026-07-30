#![allow(dead_code)]

//! Event emission utilities for the UpgradeGovernor contract.
//!
//! This module centralizes event publishing to ensure consistent topic naming
//! and data serialization across the contract.

use soroban_sdk::{Address, BytesN, Env, Symbol, Val, Vec};

use crate::{Proposal, UpgradeHistory};

/// Emit a `proposed` event when a new upgrade proposal is created.
pub fn emit_proposed(env: &Env, proposal: &Proposal) {
    env.events().publish(
        (Symbol::new(env, "proposed"),),
        (
            proposal.id,
            proposal.wasm_hash.clone(),
            proposal.execute_after,
            proposal.proposer.clone(),
        ),
    );
}

/// Emit an `executed` event when an upgrade is successfully executed.
pub fn emit_executed(env: &Env, proposal_id: u32, wasm_hash: BytesN<32>) {
    env.events()
        .publish((Symbol::new(env, "executed"),), (proposal_id, wasm_hash));
}

/// Emit a `cancelled` event when a proposal is cancelled.
pub fn emit_cancelled(env: &Env, proposal_id: u32) {
    env.events()
        .publish((Symbol::new(env, "cancelled"),), proposal_id);
}

/// Emit a `timelock_updated` event when the timelock delay changes.
pub fn emit_timelock_updated(env: &Env, new_delay: u64) {
    env.events()
        .publish((Symbol::new(env, "timelock_updated"),), new_delay);
}

/// Emit an `emergency_paused` event when the governor is paused.
pub fn emit_emergency_paused(env: &Env, reason: &str) {
    env.events()
        .publish((Symbol::new(env, "emergency_paused"),), reason);
}

/// Emit an `emergency_resumed` event when the governor is resumed.
pub fn emit_emergency_resumed(env: &Env) {
    env.events()
        .publish((Symbol::new(env, "emergency_resumed"),), ());
}

/// Emit an `upgrade_validated` event after successful WASM validation.
pub fn emit_upgrade_validated(env: &Env, wasm_hash: &BytesN<32>) {
    env.events()
        .publish((Symbol::new(env, "upgrade_validated"),), wasm_hash);
}

/// Emit an `owner_updated` event when the owner address changes.
pub fn emit_owner_updated(env: &Env, new_owner: &Address) {
    env.events()
        .publish((Symbol::new(env, "owner_updated"),), new_owner);
}

/// Emit a `multisig_updated` event when multisig config changes.
pub fn emit_multisig_updated(env: &Env, threshold: u32, signers: &Vec<Address>) {
    env.events()
        .publish((Symbol::new(env, "multisig_updated"),), (threshold, signers));
}

/// Emit a `signature_submitted` event when a multisig signature is recorded.
pub fn emit_signature_submitted(env: &Env, proposal_id: u32, signer: &Address, nonce: u64) {
    env.events().publish(
        (Symbol::new(env, "signature_submitted"),),
        (proposal_id, signer, nonce),
    );
}

/// Emit a `historical_rollup` event summarizing a batch of upgrades.
pub fn emit_historical_rollup(
    env: &Env,
    start_id: u32,
    end_id: u32,
    total_executed: u32,
    total_cancelled: u32,
) {
    env.events().publish(
        (Symbol::new(env, "historical_rollup"),),
        (start_id, end_id, total_executed, total_cancelled),
    );
}

/// Helper to construct a `Proposal` event payload for external indexing.
pub fn proposal_event_payload(proposal: &Proposal) -> (u32, BytesN<32>, u64, u64, Address) {
    (
        proposal.id,
        proposal.wasm_hash.clone(),
        proposal.execute_after,
        proposal.expires_at,
        proposal.proposer.clone(),
    )
}

/// Helper to construct an `UpgradeHistory` event payload.
pub fn history_event_payload(history: &UpgradeHistory) -> (u32, u64, Address, BytesN<32>, bool) {
    (
        history.proposal_id,
        history.executed_at,
        history.executor.clone(),
        history.new_wasm_hash.clone(),
        history.success,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{Address, BytesN, Env};

    #[test]
    fn test_emit_proposed() {
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
        emit_proposed(&env, &proposal);
        let events = env.events().all();
        assert!(events.len() >= 1);
    }

    #[test]
    fn test_emit_executed() {
        let env = Env::default();
        let wasm_hash = BytesN::from_array(&env, &[2u8; 32]);
        emit_executed(&env, 1, wasm_hash.clone());
        let events = env.events().all();
        assert!(events.len() >= 1);
    }

    #[test]
    fn test_emit_emergency_paused_and_resumed() {
        let env = Env::default();
        emit_emergency_paused(&env, "maintenance");
        emit_emergency_resumed(&env);
        let events = env.events().all();
        assert!(events.len() >= 2);
    }

    #[test]
    fn test_emit_multisig_updated() {
        let env = Env::default();
        let signers = Vec::new(&env);
        emit_multisig_updated(&env, 2, &signers);
        let events = env.events().all();
        assert!(events.len() >= 1);
    }

    #[test]
    fn test_emit_historical_rollup() {
        let env = Env::default();
        emit_historical_rollup(&env, 1, 10, 8, 2);
        let events = env.events().all();
        assert!(events.len() >= 1);
    }
}