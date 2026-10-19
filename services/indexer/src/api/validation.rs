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

/// Validate a base64-encoded pagination cursor (#1544).
///
/// Accepts standard (RFC 4648) and URL-safe base64 with or without padding.
/// Returns `ApiError::InvalidCursor` for empty strings, invalid characters,
/// or truncated padding that cannot be decoded.
pub fn validate_cursor_base64(cursor: &str) -> Result<()> {
    if cursor.is_empty() {
        return Err(ApiError::InvalidCursor(
            "cursor cannot be empty".to_string(),
        ));
    }

    use base64::{engine::general_purpose, Engine as _};
    // Try URL-safe first (most common for web cursors), fall back to standard.
    if general_purpose::URL_SAFE.decode(cursor).is_ok()
        || general_purpose::URL_SAFE_NO_PAD.decode(cursor).is_ok()
        || general_purpose::STANDARD.decode(cursor).is_ok()
        || general_purpose::STANDARD_NO_PAD.decode(cursor).is_ok()
    {
        return Ok(());
    }

    Err(ApiError::InvalidCursor(
        "cursor is not valid base64".to_string(),
    ))
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

    // ── cursor base64 validation (#1544) ──────────────────────────────────────

    #[test]
    fn test_valid_standard_base64_cursor() {
        // "hello world" encoded in standard base64
        assert!(validate_cursor_base64("aGVsbG8gd29ybGQ=").is_ok());
    }

    #[test]
    fn test_valid_url_safe_base64_cursor() {
        // URL-safe base64 (uses - and _ instead of + and /)
        assert!(validate_cursor_base64("aGVsbG8-d29ybGQ=").is_ok());
    }

    #[test]
    fn test_valid_base64_no_padding_cursor() {
        assert!(validate_cursor_base64("aGVsbG8gd29ybGQ").is_ok());
    }

    #[test]
    fn test_invalid_cursor_base64_decoding_with_special_chars() {
        // Cursors with spaces, emoji, or other non-base64 characters must be rejected.
        assert!(matches!(
            validate_cursor_base64("not valid base64!!!").unwrap_err(),
            ApiError::InvalidCursor(_)
        ));
    }

    #[test]
    fn test_invalid_cursor_base64_with_emoji() {
        assert!(matches!(
            validate_cursor_base64("🚀cursor").unwrap_err(),
            ApiError::InvalidCursor(_)
        ));
    }

    #[test]
    fn test_invalid_cursor_base64_truncated_padding() {
        // One padding character where two are required — invalid base64.
        assert!(matches!(
            validate_cursor_base64("aGVsbG8=extra=").unwrap_err(),
            ApiError::InvalidCursor(_)
        ));
    }

    #[test]
    fn test_invalid_cursor_empty_string() {
        assert!(matches!(
            validate_cursor_base64("").unwrap_err(),
            ApiError::InvalidCursor(_)
        ));
    }

    #[test]
    fn test_invalid_cursor_only_whitespace_is_rejected() {
        assert!(matches!(
            validate_cursor_base64("   ").unwrap_err(),
            ApiError::InvalidCursor(_)
        ));
    }
}
