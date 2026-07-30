#![allow(dead_code)]

//! Extended error context and helper macros for the UpgradeGovernor contract.
//!
//! Provides:
//! - Error message formatting
//! - Error categorization (user vs system)
//! - Retryability hints
//! - Documentation links

use soroban_sdk::{Address, BytesN, Env, Symbol, Vec};

use crate::{UpgradeError, Proposal};

/// Categorize an upgrade error for client handling.
pub fn categorize_error(error: &UpgradeError) -> ErrorCategory {
    match error {
        UpgradeError::TimelockNotElapsed => ErrorCategory::Retryable,
        UpgradeError::ProposalExpired => ErrorCategory::UserAction,
        UpgradeError::ProposalAlreadyExecuted => ErrorCategory::UserAction,
        UpgradeError::ProposalAlreadyCancelled => ErrorCategory::UserAction,
        UpgradeError::EmergencyPaused => ErrorCategory::System,
        UpgradeError::InvalidWasmHash => ErrorCategory::UserInput,
        UpgradeError::ArithmeticOverflow => ErrorCategory::System,
        _ => ErrorCategory::Unknown,
    }
}

/// Error severity/category for operational tooling.
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum ErrorCategory {
    UserInput,      // Malformed input, retry won't help
    UserAction,     // User must take different action
    Retryable,      // Transient, retry after delay
    System,         // Operator intervention required
    Unknown,        // Unclassified
}

/// Human-readable description of an error code.
pub fn error_message(error: &UpgradeError) -> String {
    match error {
        UpgradeError::AlreadyInitialized => "Contract already initialized".to_string(),
        UpgradeError::NotInitialized => "Contract not initialized".to_string(),
        UpgradeError::Unauthorized => "Caller is not authorized".to_string(),
        UpgradeError::InvalidWasmHash => "WASM hash is invalid or zero".to_string(),
        UpgradeError::ProposalNotFound => "Proposal not found".to_string(),
        UpgradeError::InvalidProposalId => "Proposal ID is invalid".to_string(),
        UpgradeError::ProposalAlreadyExecuted => "Proposal already executed".to_string(),
        UpgradeError::ProposalAlreadyCancelled => "Proposal already cancelled".to_string(),
        UpgradeError::TimelockNotElapsed => "Timelock has not elapsed yet".to_string(),
        UpgradeError::ArithmeticOverflow => "Arithmetic overflow".to_string(),
        UpgradeError::EmergencyPaused => "Contract is emergency paused".to_string(),
        UpgradeError::NotEmergencyPaused => "Contract is not paused".to_string(),
        UpgradeError::InvalidThreshold => "Invalid multisig threshold".to_string(),
        UpgradeError::InvalidSigner => "Invalid signer".to_string(),
        UpgradeError::InvalidVersion => "Invalid version".to_string(),
        UpgradeError::ProposalExpired => "Proposal has expired".to_string(),
        UpgradeError::DuplicateProposal => "Duplicate proposal".to_string(),
        UpgradeError::InsufficientSignatures => "Insufficient multisig signatures".to_string(),
        UpgradeError::ContractValidationFailed => "Contract validation failed".to_string(),
        UpgradeError::InvalidExpiration => "Invalid expiration".to_string(),
        UpgradeError::StorageMigrationRequired => "Storage migration required".to_string(),
        UpgradeError::UnauthorizedEmergencyAction => {
            "Unauthorized emergency action".to_string()
        }
    }
}

/// Convert a proposal into a display string for diagnostics.
pub fn proposal_diagnostic(proposal: &Proposal, now: u64) -> String {
    let age = now.saturating_sub(proposal.proposed_at);
    let remaining = proposal.expires_at.saturating_sub(now);
    format!(
        "Proposal #{}: hash={}, status={}, age={}s, ttl={}s",
        proposal.id,
        crate::utils::wasm_hash_to_hex(&proposal.wasm_hash),
        if proposal.executed {
            "executed"
        } else if proposal.cancelled {
            "cancelled"
        } else if now >= proposal.execute_after {
            "ready"
        } else {
            "pending"
        },
        age,
        remaining
    )
}

/// Check whether an error is retryable after a given delay.
pub fn is_retryable_after(error: &UpgradeError) -> Option<u64> {
    match error {
        UpgradeError::TimelockNotElapsed => Some(0), // retry after timelock elapses
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_messages_non_empty() {
        for code in [
            UpgradeError::AlreadyInitialized,
            UpgradeError::ProposalNotFound,
            UpgradeError::TimelockNotElapsed,
        ] {
            assert!(!error_message(&code).is_empty());
        }
    }

    #[test]
    fn test_categorize_error() {
        assert_eq!(
            categorize_error(&UpgradeError::TimelockNotElapsed),
            ErrorCategory::Retryable
        );
        assert_eq!(
            categorize_error(&UpgradeError::EmergencyPaused),
            ErrorCategory::System
        );
    }
}