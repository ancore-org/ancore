//! Pure validation helpers for the account contract.
//!
//! These functions encode the critical trust-boundary checks used by
//! `execute` / `add_session_key` and are intentionally Env-free so they
//! can be exercised by `cargo-fuzz` and proptest property tests.

#![allow(dead_code)]

use crate::ContractError;

/// Permission bit for send payment operations
pub const PERMISSION_SEND_PAYMENT: u32 = 0;
/// Permission bit for session-key execute authorization
pub const PERMISSION_EXECUTE: u32 = 1;
/// Permission bit for invoke contract operations
pub const PERMISSION_INVOKE_CONTRACT: u32 = 2;

/// Known permission bits accepted at session-key registration.
pub const VALID_PERMISSIONS: &[u32] = &[
    PERMISSION_SEND_PAYMENT,
    PERMISSION_EXECUTE,
    PERMISSION_INVOKE_CONTRACT,
];

/// Reject unknown or duplicate permission bits.
pub fn validate_permissions(permissions: &[u32]) -> Result<(), ContractError> {
    let mut seen = [false; 3];
    for &permission in permissions {
        let index = match permission {
            PERMISSION_SEND_PAYMENT => 0,
            PERMISSION_EXECUTE => 1,
            PERMISSION_INVOKE_CONTRACT => 2,
            _ => return Err(ContractError::InsufficientPermission),
        };
        if seen[index] {
            return Err(ContractError::InsufficientPermission);
        }
        seen[index] = true;
    }
    Ok(())
}

/// Validate spend-policy configuration at session-key registration.
pub fn validate_spend_policy(
    max_amount_per_call: Option<i128>,
    cumulative_limit: Option<i128>,
    spend_window_seconds: u64,
) -> Result<(), ContractError> {
    if let Some(limit) = max_amount_per_call {
        if limit <= 0 {
            return Err(ContractError::InvalidSpendPolicy);
        }
    }

    if let Some(limit) = cumulative_limit {
        if limit <= 0 || spend_window_seconds == 0 {
            return Err(ContractError::InvalidSpendPolicy);
        }
    }

    if spend_window_seconds > 0 && cumulative_limit.is_none() {
        return Err(ContractError::InvalidSpendPolicy);
    }

    Ok(())
}

/// Inputs for per-call / cumulative spend checks (Env-free).
#[derive(Clone, Debug)]
pub struct SpendCheckInput {
    pub amount: Option<i128>,
    pub max_amount_per_call: Option<i128>,
    pub cumulative_limit: Option<i128>,
    pub spend_window_start: u64,
    pub spend_window_seconds: u64,
    pub spent_in_window: i128,
    pub now: u64,
}

/// Enforce per-call and cumulative spend caps.
pub fn check_spend_limits(input: &SpendCheckInput) -> Result<(), ContractError> {
    let amount = match input.amount {
        Some(value) if value > 0 => value,
        _ => return Ok(()),
    };

    if let Some(limit) = input.max_amount_per_call {
        if amount > limit {
            return Err(ContractError::ExceededSpendLimit);
        }
    }

    if let Some(cumulative_limit) = input.cumulative_limit {
        let mut spent = input.spent_in_window;
        if input.now
            > input
                .spend_window_start
                .saturating_add(input.spend_window_seconds)
        {
            spent = 0;
        }

        let next_spent = spent
            .checked_add(amount)
            .ok_or(ContractError::ArithmeticOverflow)?;

        if next_spent > cumulative_limit {
            return Err(ContractError::ExceededSpendLimit);
        }
    }

    Ok(())
}

/// Strict sequential nonce check (replay protection).
#[inline]
pub fn nonce_matches(expected: u64, current: u64) -> bool {
    expected == current
}

/// Session keys are expired at (and after) `expires_at`.
#[inline]
pub fn session_key_is_expired(now: u64, expires_at: u64) -> bool {
    now >= expires_at
}

/// Allowlist check: `None` permits any target; `Some` requires membership.
pub fn allowlist_permits(allowed: Option<&[[u8; 32]]>, target: &[u8; 32]) -> bool {
    match allowed {
        None => true,
        Some(list) => list.iter().any(|entry| entry == target),
    }
}

/// Expiration must be non-zero and strictly after `now` (seconds).
pub fn validate_expiry(expires_at_secs: u64, now: u64) -> Result<(), ContractError> {
    if expires_at_secs == 0 {
        return Err(ContractError::InvalidExpiration);
    }
    if expires_at_secs <= now {
        return Err(ContractError::SessionKeyExpirationInPast);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn permissions_reject_unknown_and_duplicates() {
        assert!(validate_permissions(&[PERMISSION_EXECUTE]).is_ok());
        assert!(validate_permissions(&[PERMISSION_EXECUTE, PERMISSION_EXECUTE]).is_err());
        assert!(validate_permissions(&[99]).is_err());
    }

    #[test]
    fn spend_policy_rejects_non_positive_and_window_mismatch() {
        assert!(validate_spend_policy(Some(0), None, 0).is_err());
        assert!(validate_spend_policy(None, Some(100), 0).is_err());
        assert!(validate_spend_policy(None, None, 60).is_err());
        assert!(validate_spend_policy(Some(10), Some(100), 60).is_ok());
    }

    #[test]
    fn cumulative_cap_and_window_reset() {
        let mut input = SpendCheckInput {
            amount: Some(60),
            max_amount_per_call: Some(100),
            cumulative_limit: Some(100),
            spend_window_start: 1_000,
            spend_window_seconds: 100,
            spent_in_window: 50,
            now: 1_050,
        };
        assert!(check_spend_limits(&input).is_err());

        input.now = 1_200; // window elapsed → spent resets
        assert!(check_spend_limits(&input).is_ok());
    }

    #[test]
    fn allowlist_and_expiry_helpers() {
        let a = [1u8; 32];
        let b = [2u8; 32];
        assert!(allowlist_permits(None, &a));
        assert!(allowlist_permits(Some(&[a]), &a));
        assert!(!allowlist_permits(Some(&[a]), &b));
        assert!(session_key_is_expired(10, 10));
        assert!(!session_key_is_expired(9, 10));
        assert!(validate_expiry(11, 10).is_ok());
        assert!(validate_expiry(10, 10).is_err());
    }
}
