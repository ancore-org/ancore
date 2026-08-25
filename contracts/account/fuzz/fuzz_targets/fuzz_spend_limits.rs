#![no_main]

use ancore_account::validation::{check_spend_limits, SpendCheckInput};
use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    if data.len() < 64 {
        return;
    }

    let amount = i128::from_le_bytes(data[0..16].try_into().unwrap());
    let max_per_call = i128::from_le_bytes(data[16..32].try_into().unwrap());
    let cumulative = i128::from_le_bytes(data[32..48].try_into().unwrap());
    let spent = i128::from_le_bytes(data[48..64].try_into().unwrap());
    let now = u64::from_le_bytes(data.get(64..72).and_then(|s| s.try_into().ok()).unwrap_or([0; 8]));
    let window_start =
        u64::from_le_bytes(data.get(72..80).and_then(|s| s.try_into().ok()).unwrap_or([0; 8]));
    let window_secs =
        u64::from_le_bytes(data.get(80..88).and_then(|s| s.try_into().ok()).unwrap_or([0; 8]));

    let input = SpendCheckInput {
        amount: (data[0] & 1 == 1).then_some(amount),
        max_amount_per_call: (data.get(1).copied().unwrap_or(0) & 1 == 1).then_some(max_per_call),
        cumulative_limit: (data.get(2).copied().unwrap_or(0) & 1 == 1).then_some(cumulative),
        spend_window_start: window_start,
        spend_window_seconds: window_secs,
        spent_in_window: spent,
        now,
    };

    // Must never panic — only return Ok or a typed ContractError.
    let _ = check_spend_limits(&input);
});
