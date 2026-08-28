//! WASM contract validation logic for the UpgradeGovernor.
//!
//! Validates a proposer's WASM attestation — the caller's self-reported
//! size, exports, and imports — against the stored `ContractValidation`
//! policy. Because Soroban contracts cannot retrieve WASM bytes from a
//! hash at execution time, this is an **attestation model**: the contract
//! enforces the policy on the declared metadata; off-chain tooling must
//! independently verify that the declaration matches the actual WASM at
//! `new_wasm_hash` before signing or broadcasting the proposal.

use soroban_sdk::{BytesN, Env};
#[cfg(test)]
use soroban_sdk::{String, Vec};

use crate::{ContractValidation, UpgradeError, WasmAttestation};

/// Validate a proposed WASM hash and metadata attestation against policy.
///
/// Checks performed (in order):
/// 1. Hash must not be the all-zero sentinel.
/// 2. `attestation.wasm_size >= validation.min_wasm_size` (when `min > 0`).
/// 3. `attestation.wasm_size <= validation.max_wasm_size` (when `max > 0`).
/// 4. Every name in `validation.required_exports` must appear in `attestation.exports`.
/// 5. No name in `validation.forbidden_imports` may appear in `attestation.imports`.
pub fn validate_wasm_metadata(
    env: &Env,
    wasm_hash: &BytesN<32>,
    validation: &ContractValidation,
    attestation: &WasmAttestation,
) -> Result<(), UpgradeError> {
    if wasm_hash == &BytesN::from_array(env, &[0u8; 32]) {
        return Err(UpgradeError::InvalidWasmHash);
    }

    if validation.min_wasm_size > 0 && attestation.wasm_size < validation.min_wasm_size {
        return Err(UpgradeError::WasmTooSmall);
    }
    if validation.max_wasm_size > 0 && attestation.wasm_size > validation.max_wasm_size {
        return Err(UpgradeError::WasmTooLarge);
    }

    for required in validation.required_exports.iter() {
        if !attestation.exports.contains(required) {
            return Err(UpgradeError::MissingRequiredExport);
        }
    }

    for forbidden in validation.forbidden_imports.iter() {
        if attestation.imports.contains(forbidden) {
            return Err(UpgradeError::ForbiddenImportDetected);
        }
    }

    Ok(())
}

/// Build a validation policy that requires specific exported function names.
#[cfg(test)]
pub fn require_exports(env: &Env, names: Vec<String>) -> ContractValidation {
    ContractValidation {
        min_wasm_size: 1024,
        max_wasm_size: 10 * 1024 * 1024,
        required_exports: names,
        forbidden_imports: Vec::new(env),
    }
}

/// Build a validation policy that forbids specific import patterns.
#[cfg(test)]
pub fn forbid_imports(env: &Env, patterns: Vec<String>) -> ContractValidation {
    ContractValidation {
        min_wasm_size: 1024,
        max_wasm_size: 10 * 1024 * 1024,
        required_exports: Vec::new(env),
        forbidden_imports: patterns,
    }
}

/// Merge two validation configs (intersection of constraints).
#[cfg(test)]
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
        if b.required_exports.contains(&name) {
            required.push_back(name.clone());
        }
    }

    let mut forbidden = Vec::new(env);
    for name in a.forbidden_imports.iter() {
        forbidden.push_back(name.clone());
    }
    for name in b.forbidden_imports.iter() {
        if !forbidden.contains(&name) {
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

    fn permissive(env: &Env) -> ContractValidation {
        ContractValidation {
            min_wasm_size: 0,
            max_wasm_size: 0,
            required_exports: Vec::new(env),
            forbidden_imports: Vec::new(env),
        }
    }

    fn default_attestation(env: &Env) -> WasmAttestation {
        WasmAttestation {
            wasm_size: 4096,
            exports: Vec::new(env),
            imports: Vec::new(env),
        }
    }

    #[test]
    fn test_reject_zero_hash() {
        let env = Env::default();
        let validation = permissive(&env);
        let attestation = default_attestation(&env);
        let zero = BytesN::from_array(&env, &[0u8; 32]);
        let result = validate_wasm_metadata(&env, &zero, &validation, &attestation);
        assert!(matches!(result, Err(UpgradeError::InvalidWasmHash)));
    }

    #[test]
    fn test_wasm_too_small() {
        let env = Env::default();
        let validation = ContractValidation {
            min_wasm_size: 1024,
            max_wasm_size: 0,
            required_exports: Vec::new(&env),
            forbidden_imports: Vec::new(&env),
        };
        let attestation = WasmAttestation {
            wasm_size: 512,
            exports: Vec::new(&env),
            imports: Vec::new(&env),
        };
        let hash = BytesN::from_array(&env, &[1u8; 32]);
        let result = validate_wasm_metadata(&env, &hash, &validation, &attestation);
        assert!(matches!(result, Err(UpgradeError::WasmTooSmall)));
    }

    #[test]
    fn test_wasm_too_large() {
        let env = Env::default();
        let validation = ContractValidation {
            min_wasm_size: 0,
            max_wasm_size: 1024,
            required_exports: Vec::new(&env),
            forbidden_imports: Vec::new(&env),
        };
        let attestation = WasmAttestation {
            wasm_size: 2048,
            exports: Vec::new(&env),
            imports: Vec::new(&env),
        };
        let hash = BytesN::from_array(&env, &[1u8; 32]);
        let result = validate_wasm_metadata(&env, &hash, &validation, &attestation);
        assert!(matches!(result, Err(UpgradeError::WasmTooLarge)));
    }

    #[test]
    fn test_missing_required_export() {
        let env = Env::default();
        let mut required = Vec::new(&env);
        required.push_back(String::from_str(&env, "upgrade"));
        let validation = ContractValidation {
            min_wasm_size: 0,
            max_wasm_size: 0,
            required_exports: required,
            forbidden_imports: Vec::new(&env),
        };
        let attestation = WasmAttestation {
            wasm_size: 4096,
            exports: Vec::new(&env),
            imports: Vec::new(&env),
        };
        let hash = BytesN::from_array(&env, &[1u8; 32]);
        let result = validate_wasm_metadata(&env, &hash, &validation, &attestation);
        assert!(matches!(result, Err(UpgradeError::MissingRequiredExport)));
    }

    #[test]
    fn test_forbidden_import_detected() {
        let env = Env::default();
        let mut forbidden = Vec::new(&env);
        forbidden.push_back(String::from_str(&env, "dangerous_fn"));
        let validation = ContractValidation {
            min_wasm_size: 0,
            max_wasm_size: 0,
            required_exports: Vec::new(&env),
            forbidden_imports: forbidden,
        };
        let mut imports = Vec::new(&env);
        imports.push_back(String::from_str(&env, "dangerous_fn"));
        let attestation = WasmAttestation {
            wasm_size: 4096,
            exports: Vec::new(&env),
            imports,
        };
        let hash = BytesN::from_array(&env, &[1u8; 32]);
        let result = validate_wasm_metadata(&env, &hash, &validation, &attestation);
        assert!(matches!(result, Err(UpgradeError::ForbiddenImportDetected)));
    }

    #[test]
    fn test_passes_with_all_constraints_met() {
        let env = Env::default();
        let mut required = Vec::new(&env);
        required.push_back(String::from_str(&env, "upgrade"));
        let mut forbidden = Vec::new(&env);
        forbidden.push_back(String::from_str(&env, "dangerous_fn"));
        let validation = ContractValidation {
            min_wasm_size: 1024,
            max_wasm_size: 1024 * 1024,
            required_exports: required,
            forbidden_imports: forbidden,
        };
        let mut exports = Vec::new(&env);
        exports.push_back(String::from_str(&env, "upgrade"));
        exports.push_back(String::from_str(&env, "get_version"));
        let attestation = WasmAttestation {
            wasm_size: 8192,
            exports,
            imports: Vec::new(&env),
        };
        let hash = BytesN::from_array(&env, &[1u8; 32]);
        let result = validate_wasm_metadata(&env, &hash, &validation, &attestation);
        assert!(result.is_ok());
    }

    #[test]
    fn test_size_bounds_disabled_when_zero() {
        let env = Env::default();
        let validation = permissive(&env);
        // wasm_size = 0 should pass when both bounds are 0 (disabled)
        let attestation = WasmAttestation {
            wasm_size: 0,
            exports: Vec::new(&env),
            imports: Vec::new(&env),
        };
        let hash = BytesN::from_array(&env, &[1u8; 32]);
        let result = validate_wasm_metadata(&env, &hash, &validation, &attestation);
        assert!(result.is_ok());
    }

    #[test]
    fn test_merge_validation_intersection() {
        let env = Env::default();
        let a = require_exports(&env, {
            let mut v = Vec::new(&env);
            v.push_back(String::from_str(&env, "upgrade"));
            v.push_back(String::from_str(&env, "get_version"));
            v
        });
        let b = require_exports(&env, {
            let mut v = Vec::new(&env);
            v.push_back(String::from_str(&env, "upgrade"));
            v.push_back(String::from_str(&env, "migrate"));
            v
        });
        let merged = merge_validation(&env, &a, &b);
        assert!(merged
            .required_exports
            .contains(String::from_str(&env, "upgrade")));
        assert!(!merged
            .required_exports
            .contains(String::from_str(&env, "get_version")));
        assert!(!merged
            .required_exports
            .contains(String::from_str(&env, "migrate")));
    }
}
