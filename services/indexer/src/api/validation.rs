//! Shared request-parameter validation helpers for API handlers.
//!
//! Centralized here so a fix to one validator (e.g. the StrKey checksum fix
//! for account IDs) only needs to happen in one place instead of drifting
//! across every handler module that duplicated its own copy.

use crate::error::{ApiError, Result};

/// Validate a Stellar account ID as a checksummed StrKey G-address.
///
/// Unlike a naive shape check (56 characters starting with `G`), this
/// verifies the StrKey checksum via `stellar_strkey`, rejecting strings that
/// merely look like a public key but fail the checksum.
pub fn validate_account_id(id: &str) -> Result<()> {
    if id.is_empty() {
        return Err(ApiError::InvalidFilter(
            "account_id cannot be empty".to_string(),
        ));
    }

    match stellar_strkey::Strkey::from_string(id) {
        Ok(stellar_strkey::Strkey::PublicKeyEd25519(_)) => Ok(()),
        _ => Err(ApiError::InvalidFilter(
            "account_id must be a valid Stellar public key (StrKey G-address)".to_string(),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_valid_g_strkey() {
        let addr = "GBBM6BKZPEHWYO3E3YKREDPQXMS4VK35YLNU7NFBRI26RAN7GI5POFBB";
        assert!(validate_account_id(addr).is_ok());
    }

    #[test]
    fn rejects_empty_string() {
        assert!(matches!(
            validate_account_id("").unwrap_err(),
            ApiError::InvalidFilter(_)
        ));
    }

    #[test]
    fn rejects_naive_shape_match_with_bad_checksum() {
        // Right length (56) and starts with 'G', but not a real checksummed
        // StrKey — this is exactly what the naive shape-only check let through.
        let addr = format!("G{}", "A".repeat(55));
        assert!(matches!(
            validate_account_id(&addr).unwrap_err(),
            ApiError::InvalidFilter(_)
        ));
    }

    #[test]
    fn rejects_contract_address_shaped_string() {
        // Right length and a 'C' prefix (contract StrKeys use this prefix),
        // but not a checksummed contract address either — still must fail.
        let addr = format!("C{}", "A".repeat(55));
        assert!(matches!(
            validate_account_id(&addr).unwrap_err(),
            ApiError::InvalidFilter(_)
        ));
    }

    #[test]
    fn rejects_too_short() {
        assert!(matches!(
            validate_account_id("GSHORT").unwrap_err(),
            ApiError::InvalidFilter(_)
        ));
    }
}
