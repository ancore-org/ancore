#![allow(dead_code)]

//! Utility functions and helpers for the UpgradeGovernor contract.
//!
//! Common helper functions, formatting utilities, and conversion helpers
//! used across the contract modules.

use soroban_sdk::{Address, BytesN, Env, Symbol, Vec};

use crate::{Proposal, UpgradeHistory, UpgradeError, DataKey};

/// Convert a WASM hash to a hex string for display/logging.
pub fn wasm_hash_to_hex(wasm_hash: &BytesN<32>) -> String {
    let bytes = wasm_hash.to_array::<[u8; 32]>();
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Parse a hex string into a WASM hash.
pub fn hex_to_wasm_hash(env: &Env, hex: &str) -> Result<BytesN<32>, UpgradeError> {
    if hex.len() != 64 {
        return Err(UpgradeError::InvalidWasmHash);
    }

    let mut bytes = [0u8; 32];
    for i in 0..32 {
        let byte_str = &hex[i * 2..i * 2 + 2];
        bytes[i] = u8::from_str_radix(byte_str, 16)
            .map_err(|_| UpgradeError::InvalidWasmHash)?;
    }

    Ok(BytesN::from_array(env, &bytes))
}

/// Format a proposal with human-readable timestamps.
pub fn format_proposal(proposal: &Proposal, now: u64) -> String {
    let status = if proposal.executed {
        "executed"
    } else if proposal.cancelled {
        "cancelled"
    } else if now >= proposal.execute_after {
        "ready"
    } else {
        "pending"
    };

    format!(
        "Proposal #{}: {} (hash: {:?})",
        proposal.id, status, proposal.wasm_hash
    )
}

/// Format an upgrade history entry.
pub fn format_history(history: &UpgradeHistory) -> String {
    format!(
        "Upgrade #{}: {} at {}, success={}",
        history.proposal_id, history.executor, history.executed_at, history.success
    )
}

/// Validate that a description string is within allowed length.
pub fn validate_description(description: &str, max_length: usize) -> Result<(), UpgradeError> {
    if description.len() > max_length {
        return Err(UpgradeError::InvalidVersion);
    }
    Ok(())
}

/// Validate that an expiration window is reasonable (non-zero, not excessively long).
pub fn validate_expiration(expiration: u64, max_allowed: u64) -> Result<(), UpgradeError> {
    if expiration == 0 {
        return Err(UpgradeError::InvalidExpiration);
    }
    if expiration > max_allowed {
        return Err(UpgradeError::InvalidExpiration);
    }
    Ok(())
}

/// Compute a checksum of a WASM hash for quick comparison.
pub fn wasm_checksum(wasm_hash: &BytesN<32>) -> u32 {
    let bytes = wasm_hash.to_array::<[u8; 32]>();
    bytes.iter().fold(0u32, |acc, &b| acc.wrapping_add(b as u32))
}

/// Check if two WASM hashes are equal.
pub fn wasm_hash_eq(a: &BytesN<32>, b: &BytesN<32>) -> bool {
    a.to_array::<[u8; 32]>() == b.to_array::<[u8; 32]>()
}

/// Truncate a string to a max length with ellipsis.
pub fn truncate_string(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len.saturating_sub(3)])
    }
}

/// Merge two Vec<Address> removing duplicates while preserving order.
pub fn merge_address_lists(a: Vec<Address>, b: Vec<Address>) -> Vec<Address> {
    use soroban_sdk::Vec;
    let mut result = Vec::new(&a);
    
    for addr in b.iter() {
        let mut found = false;
        for existing in result.iter() {
            if &existing == &addr {
                found = true;
                break;
            }
        }
        if !found {
            result.push_back(addr);
        }
    }
    
    result
}

/// Count active (non-executed, non-cancelled) proposals.
pub fn count_active_proposals(env: &Env) -> u32 {
    let next_id: u32 = env
        .storage()
        .instance()
        .get(&DataKey::NextProposalId)
        .unwrap_or(1);

    let mut count = 0;
    for id in 1..next_id {
        if let Some(proposal) = env.storage().instance().get(&DataKey::Proposal(id)) {
            if !proposal.executed && !proposal.cancelled {
                count += 1;
            }
        }
    }
    count
}

/// Determine if the governor is healthy (no critical failure rate).
pub fn is_governor_healthy(env: &Env, failure_threshold: f64) -> bool {
    let next_id: u32 = env
        .storage()
        .instance()
        .get(&DataKey::NextHistoryId)
        .unwrap_or(1);

    let mut total = 0;
    let mut failures = 0;
    for id in 1..next_id {
        if let Some(entry) = env.storage().instance().get(&DataKey::UpgradeHistory(id)) {
            total += 1;
            if !entry.success {
                failures += 1;
            }
        }
    }

    if total == 0 {
        return true;
    }

    (failures as f64 / total as f64) < failure_threshold
}

/// Convert a Unix timestamp to a human-readable relative time string.
pub fn format_relative_time(now: u64, timestamp: u64) -> String {
    let delta = if now >= timestamp {
        now - timestamp
    } else {
        timestamp - now
    };

    if delta < 60 {
        format!("{} seconds", delta)
    } else if delta < 3600 {
        format!("{} minutes", delta / 60)
    } else if delta < 86400 {
        format!("{} hours", delta / 3600)
    } else {
        format!("{} days", delta / 86400)
    }
}

/// Check if a timestamp is in the past.
pub fn is_past(now: u64, timestamp: u64) -> bool {
    now > timestamp
}

/// Check if a timestamp is in the future.
pub fn is_future(now: u64, timestamp: u64) -> bool {
    now < timestamp
}

/// Compute the minimum of two u64 values.
pub fn min_u64(a: u64, b: u64) -> u64 {
    if a < b { a } else { b }
}

/// Compute the maximum of two u64 values.
pub fn max_u64(a: u64, b: u64) -> u64 {
    if a > b { a } else { b }
}

/// Saturating addition for u64 with explicit overflow handling.
pub fn safe_add_u64(a: u64, b: u64) -> Result<u64, UpgradeError> {
    a.checked_add(b).ok_or(UpgradeError::ArithmeticOverflow)
}

/// Saturating subtraction for u64 with explicit underflow handling.
pub fn safe_sub_u64(a: u64, b: u64) -> Result<u64, UpgradeError> {
    a.checked_sub(b).ok_or(UpgradeError::ArithmeticOverflow)
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{Address, BytesN, Env};

    #[test]
    fn test_wasm_hash_roundtrip() {
        let env = Env::default();
        let hash = BytesN::from_array(&env, &[0xAB; 32]);
        let hex = wasm_hash_to_hex(&hash);
        let parsed = hex_to_wasm_hash(&env, &hex).unwrap();
        assert!(wasm_hash_eq(&hash, &parsed));
    }

    #[test]
    fn test_format_proposal_states() {
        let env = Env::default();
        let proposal = Proposal {
            id: 1,
            wasm_hash: BytesN::from_array(&env, &[1u8; 32]),
            proposed_at: 1000,
            execute_after: 1010,
            expires_at: 2000,
            executed: true,
            cancelled: false,
            proposer: Address::generate(&env),
            description: None,
            metadata: None,
        };
        let formatted = format_proposal(&proposal, 1500);
        assert!(formatted.contains("executed"));
    }

    #[test]
    fn test_truncate_string() {
        assert_eq!(truncate_string("hello world", 8), "hello...");
        assert_eq!(truncate_string("hi", 8), "hi");
    }

    #[test]
    fn test_safe_add_u64_overflow() {
        assert!(safe_add_u64(u64::MAX, 1).is_err());
        assert_eq!(safe_add_u64(10, 20).unwrap(), 30);
    }

    #[test]
    fn test_merge_address_lists() {
        let env = Env::default();
        let a = Vec::from_array(&env, [Address::generate(&env)]);
        let b = Vec::from_array(&env, [Address::generate(&env)]);
        let merged = merge_address_lists(a, b);
        assert_eq!(merged.len(), 2);
    }
}