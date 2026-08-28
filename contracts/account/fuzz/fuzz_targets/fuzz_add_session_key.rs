#![no_main]

//! Fuzz the `add_session_key` input validators (permissions, spend policy, expiry).

use ancore_account::validation::{
    validate_expiry, validate_permissions, validate_spend_policy,
};
use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    if data.len() < 32 {
        return;
    }

    let permissions: Vec<u32> = data.iter().take(8).map(|b| u32::from(*b % 5)).collect();
    let _ = validate_permissions(&permissions);

    let max_raw = i128::from_le_bytes(data[8..24].try_into().unwrap_or([0; 16]));
    let window = u64::from_le_bytes(data[24..32].try_into().unwrap());
    let cum_raw = if data.len() >= 48 {
        i128::from_le_bytes(data[32..48].try_into().unwrap_or([0; 16]))
    } else {
        max_raw.saturating_mul(2)
    };
    let has_max = data[0] & 1 == 1;
    let has_cum = data[1] & 1 == 1;

    let _ = validate_spend_policy(
        has_max.then_some(max_raw),
        has_cum.then_some(cum_raw),
        window,
    );

    let now = u64::from_le_bytes(data.get(48..56).and_then(|s| s.try_into().ok()).unwrap_or([0; 8]));
    let expires =
        u64::from_le_bytes(data.get(56..64).and_then(|s| s.try_into().ok()).unwrap_or([0; 8]));
    let _ = validate_expiry(expires, now);
});
