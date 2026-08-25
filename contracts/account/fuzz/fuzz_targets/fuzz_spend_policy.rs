#![no_main]

use ancore_account::validation::validate_spend_policy;
use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    if data.len() < 18 {
        return;
    }
    let max_raw = i128::from_le_bytes(data[0..16].try_into().unwrap_or([0; 16]));
    let window = u64::from_le_bytes(data[16..24.min(data.len())].try_into().unwrap_or([0; 8]));
    let has_max = data[0] & 1 == 1;
    let has_cum = data.get(1).copied().unwrap_or(0) & 1 == 1;
    let cum_raw = if data.len() >= 40 {
        i128::from_le_bytes(data[24..40].try_into().unwrap_or([0; 16]))
    } else {
        max_raw
    };

    let _ = validate_spend_policy(
        has_max.then_some(max_raw),
        has_cum.then_some(cum_raw),
        window,
    );
});
