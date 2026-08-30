#![no_main]

//! Fuzz execute-path argument validation: nonce match + expiry + allowlist.
//! Mirrors the pre-auth checks in `AncoreAccount::execute` without needing Env.

use ancore_account::validation::{
    allowlist_permits, nonce_matches, session_key_is_expired, validate_expiry,
};
use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    if data.len() < 40 {
        return;
    }

    let expected = u64::from_le_bytes(data[0..8].try_into().unwrap());
    let current = u64::from_le_bytes(data[8..16].try_into().unwrap());
    let now = u64::from_le_bytes(data[16..24].try_into().unwrap());
    let expires_at = u64::from_le_bytes(data[24..32].try_into().unwrap());

    let _ = nonce_matches(expected, current);
    let _ = session_key_is_expired(now, expires_at);
    let _ = validate_expiry(expires_at, now);

    let mut target = [0u8; 32];
    let src = &data[32..data.len().min(64)];
    target[..src.len()].copy_from_slice(src);

    let mut allow = [[0u8; 32]; 4];
    let mut count = 0usize;
    let mut offset = 64;
    while offset + 32 <= data.len() && count < allow.len() {
        allow[count].copy_from_slice(&data[offset..offset + 32]);
        count += 1;
        offset += 32;
    }

    let unrestricted = data.get(3).copied().unwrap_or(0) & 1 == 1;
    if unrestricted {
        let _ = allowlist_permits(None, &target);
    } else {
        let _ = allowlist_permits(Some(&allow[..count]), &target);
    }
});
