#![no_main]

use ancore_account::validation::allowlist_permits;
use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    if data.is_empty() {
        return;
    }

    let mut target = [0u8; 32];
    let take = data.len().min(32);
    target[..take].copy_from_slice(&data[..take]);

    if data[0] & 1 == 0 {
        let _ = allowlist_permits(None, &target);
        return;
    }

    let mut entries = [[0u8; 32]; 8];
    let mut count = 0usize;
    let mut offset = 1;
    while offset + 32 <= data.len() && count < entries.len() {
        entries[count].copy_from_slice(&data[offset..offset + 32]);
        count += 1;
        offset += 32;
    }

    let allowed = allowlist_permits(Some(&entries[..count]), &target);
    // Invariant: membership is exact equality on 32-byte ids.
    let expected = entries[..count].iter().any(|e| e == &target);
    assert_eq!(allowed, expected);
});
