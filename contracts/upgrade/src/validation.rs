#![allow(dead_code)]

//! WASM contract validation logic for the UpgradeGovernor.
//!
//! Provides hooks for inspecting a proposed WASM blob before execution:
//! - Size bounds
//! - Required export names
//! - Forbidden import patterns
//!
//! In production, the host environment can provide WASM metadata queries;
//! this module documents the expected interface and defensive checks.

use soroban_sdk::{BytesN, Env};

use crate::{ContractValidation, UpgradeError};

/// Validate a proposed WASM hash against the current contract validation rules.
///
/// # Parameters
/// - `env`: Soroban environment
/// - `wasm_hash`: Hash of the proposed WASM blob
/// - `validation`: Current validation configuration
///
/// # Returns
/// `Ok(())` if validation passes, or an `UpgradeError` on failure.
pub fn validate_wasm_metadata(
    _env: &Env,
    wasm_hash: &BytesN<32>,
    validation: &ContractValidation,
) -> Result<(), UpgradeError> {
    // Defensive checks that do not require fetching the actual WASM bytes.
    // In a full integration, the host would expose:
    //   env.wasm_metadata(wasm_hash) -> { size: u32, exports: Vec<String>, imports: Vec<String> }
    // For now, we enforce rules that can be checked without host support.

    if wasm_hash == &BytesN::from_array(_env, &[0u8; 32]) {
        return Err(UpgradeError::InvalidWasmHash);
    }

    // Placeholder: real WASM size/export/import checks would happen here.
    // The contract currently enforces these rules at the policy level during
    // `set_contract_validation` and re-checks at execution time.

    Ok(())
}

/// Build a validation rule that requires specific exported function names.
pub fn require_exports(env: &Env, names: Vec<String>) -> ContractValidation {
    ContractValidation {
        min_wasm_size: 1024,
        max_wasm_size: 10 * 1024 * 1024,
        required_exports: names,
        forbidden_imports: Vec::new(env),
    }
}

/// Build a validation rule that forbids specific import patterns.
pub fn forbid_imports(env: &Env, patterns: Vec<String>) -> ContractValidation {
    ContractValidation {
        min_wasm_size: 1024,
        max_wasm_size: 10 * 1024 * 1024,
        required_exports: Vec::new(env),
        forbidden_imports: patterns,
    }
}

/// Merge two validation configs (intersection of constraints).
pub fn merge_validation(
    env: &Env,
    a: &ContractValidation,
    b: &ContractValidation,
) -> ContractValidation {
    let min_size = a.min_wasm_size.max(b.min_wasm_size);
    let max_size = if a.max_wasm_size == 0 {
        b.max_wasm_size
    } else if b.max_wasm_size == 0 {
        a.max_wasm_size
    } else {
        a.max_wasm_size.min(b.max_wasm_size)
    };

    let mut required = Vec::new(env);
    for name in a.required_exports.iter() {
        if b.required_exports.contains(name) {
            required.push_back(name.clone());
        }
    }

    let mut forbidden = Vec::new(env);
    for name in a.forbidden_imports.iter() {
        forbidden.push_back(name.clone());
    }
    for name in b.forbidden_imports.iter() {
        if !forbidden.contains(name) {
            forbidden.push_back(name.clone());
        }
    }

    ContractValidation {
        min_wasm_size: min_size,
        max_wasm_size: max_size,
        required_exports: required,
        forbidden_imports: forbidden,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{BytesN, Env};

    #[test]
    fn test_reject_zero_hash() {
        let env = Env::default();
        let validation = ContractValidation {
            min_wasm_size: 0,
            max_wasm_size: 0,
            required_exports: Vec::new(&env),
            forbidden_imports: Vec::new(&env),
        };
        let zero = BytesN::from_array(&env, &[0u8; 32]);
        assert!(validate_wasm_metadata(&env, &zero, &validation).is_err());
    }

    #[test]
    fn test_merge_validation_intersection() {
        let env = Env::default();
        let a = require_exports(&env, vec!["upgrade".to_string(), "get_version".to_string()]);
        let b = require_exports(&env, vec!["upgrade".to_string(), "migrate".to_string()]);
        let merged = merge_validation(&env, &a, &b);
        assert!(merged.required_exports.contains(&"upgrade".to_string()));
        assert!(!merged.required_exports.contains(&"get_version".to_string()));
        assert!(!merged.required_exports.contains(&"migrate".to_string()));
    }
}