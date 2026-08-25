//! Property tests for account-contract trust-boundary invariants.
//!
//! These complement cargo-fuzz targets under `fuzz/` by asserting
//! higher-level behaviors through the Soroban test Env.

use ancore_account::validation::{
    allowlist_permits, check_spend_limits, nonce_matches, session_key_is_expired,
    validate_expiry, validate_permissions, validate_spend_policy, SpendCheckInput,
    PERMISSION_EXECUTE, PERMISSION_INVOKE_CONTRACT, PERMISSION_SEND_PAYMENT,
};
use ancore_account::ContractError;
use proptest::prelude::*;

proptest! {
    #![proptest_config(ProptestConfig::with_cases(256))]

    #[test]
    fn nonce_monotonicity_requires_exact_match(
        current in 0u64..1_000_000,
        delta in 1u64..10_000,
    ) {
        prop_assert!(nonce_matches(current, current));
        prop_assert!(!nonce_matches(current.saturating_add(delta), current));
        prop_assert!(!nonce_matches(current.saturating_sub(delta.min(current)), current)
            || delta > current);
    }

    #[test]
    fn expired_keys_always_reject(
        now in 0u64..u64::MAX / 2,
        skew in 0u64..1_000_000,
    ) {
        let expires_at = now;
        prop_assert!(session_key_is_expired(now, expires_at));
        prop_assert!(session_key_is_expired(now.saturating_add(skew), expires_at));
        if skew > 0 {
            prop_assert!(!session_key_is_expired(now, now.saturating_add(skew)));
            prop_assert!(validate_expiry(now.saturating_add(skew), now).is_ok());
        }
        prop_assert!(validate_expiry(now, now).is_err());
        prop_assert_eq!(validate_expiry(0, now), Err(ContractError::InvalidExpiration));
    }

    #[test]
    fn cumulative_spend_caps_never_exceed_limit(
        amount in 1i128..10_000,
        cumulative_limit in 1i128..10_000,
        spent_in_window in 0i128..10_000,
        window_seconds in 1u64..10_000,
        now_offset in 0u64..20_000,
    ) {
        let spend_window_start = 1_000u64;
        let now = spend_window_start.saturating_add(now_offset);
        let input = SpendCheckInput {
            amount: Some(amount),
            max_amount_per_call: None,
            cumulative_limit: Some(cumulative_limit),
            spend_window_start,
            spend_window_seconds: window_seconds,
            spent_in_window,
            now,
        };

        let window_elapsed = now > spend_window_start.saturating_add(window_seconds);
        let effective_spent = if window_elapsed { 0 } else { spent_in_window };
        let expected_ok = match effective_spent.checked_add(amount) {
            Some(next) => next <= cumulative_limit,
            None => false,
        };

        match check_spend_limits(&input) {
            Ok(()) => prop_assert!(expected_ok),
            Err(ContractError::ExceededSpendLimit | ContractError::ArithmeticOverflow) => {
                prop_assert!(!expected_ok);
            }
            Err(other) => prop_assert!(false, "unexpected error: {:?}", other),
        }
    }

    #[test]
    fn per_call_limit_rejects_overspend(
        amount in 1i128..10_000,
        max_amount_per_call in 1i128..10_000,
    ) {
        let input = SpendCheckInput {
            amount: Some(amount),
            max_amount_per_call: Some(max_amount_per_call),
            cumulative_limit: None,
            spend_window_start: 0,
            spend_window_seconds: 0,
            spent_in_window: 0,
            now: 0,
        };
        if amount > max_amount_per_call {
            prop_assert_eq!(
                check_spend_limits(&input),
                Err(ContractError::ExceededSpendLimit)
            );
        } else {
            prop_assert!(check_spend_limits(&input).is_ok());
        }
    }

    #[test]
    fn spend_policy_invariants(
        max_per_call in prop::option::of(-100i128..10_000),
        cumulative in prop::option::of(-100i128..10_000),
        window in 0u64..10_000,
    ) {
        let result = validate_spend_policy(max_per_call, cumulative, window);
        let valid = match (max_per_call, cumulative, window) {
            (Some(m), _, _) if m <= 0 => false,
            (_, Some(c), w) if c <= 0 || w == 0 => false,
            (_, None, w) if w > 0 => false,
            _ => true,
        };
        prop_assert_eq!(result.is_ok(), valid);
    }

    #[test]
    fn permission_vector_rejects_invalid_bits(
        bits in prop::collection::vec(0u32..8, 0..6),
    ) {
        let result = validate_permissions(&bits);
        let mut seen = [false; 3];
        let mut ok = true;
        for bit in bits {
            let idx = match bit {
                PERMISSION_SEND_PAYMENT => 0,
                PERMISSION_EXECUTE => 1,
                PERMISSION_INVOKE_CONTRACT => 2,
                _ => {
                    ok = false;
                    break;
                }
            };
            if seen[idx] {
                ok = false;
                break;
            }
            seen[idx] = true;
        }
        prop_assert_eq!(result.is_ok(), ok);
    }

    #[test]
    fn allowlist_membership_is_exact(
        target_byte in 0u8..8,
        allowed_bytes in prop::collection::vec(0u8..8, 0..5),
        unrestricted in any::<bool>(),
    ) {
        let target = [target_byte; 32];
        if unrestricted {
            prop_assert!(allowlist_permits(None, &target));
        } else {
            let list: Vec<[u8; 32]> = allowed_bytes.iter().map(|b| [*b; 32]).collect();
            let expected = list.iter().any(|e| e == &target);
            prop_assert_eq!(allowlist_permits(Some(list.as_slice()), &target), expected);
        }
    }
}
