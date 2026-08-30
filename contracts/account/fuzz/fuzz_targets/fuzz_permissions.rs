#![no_main]

use ancore_account::validation::validate_permissions;
use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    // Interpret each byte as a permission bit candidate.
    let permissions: Vec<u32> = data.iter().take(16).map(|b| u32::from(*b)).collect();
    let _ = validate_permissions(&permissions);
});
