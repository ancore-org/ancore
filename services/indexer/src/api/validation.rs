//! Shared request-parameter validation helpers for API handlers.
//!
//! Centralized here so a fix to one validator (e.g. the StrKey checksum fix
//! for account IDs) only needs to happen in one place instead of drifting
//! across every handler module that duplicated its own copy.

use base64::Engine;
use chrono::DateTime;
use uuid::Uuid;

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

/// Validate a pagination cursor string.
///
/// Validates that the cursor is non-empty, contains valid base64 encoding
/// (supporting standard and URL-safe base64 with or without padding), decodes to
/// valid UTF-8, and deserializes into a canonical cursor JSON object with a valid
/// timestamp `t` and UUID `i`.
///
/// Returns [`ApiError::InvalidCursor`] with an actionable error description on failure.
pub fn validate_cursor(cursor: &str) -> Result<()> {
    if cursor.trim().is_empty() {
        return Err(ApiError::InvalidCursor(
            "Cursor cannot be empty".to_string(),
        ));
    }

    let decoded = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(cursor)
        .or_else(|_| base64::engine::general_purpose::URL_SAFE.decode(cursor))
        .or_else(|_| base64::engine::general_purpose::STANDARD_NO_PAD.decode(cursor))
        .or_else(|_| base64::engine::general_purpose::STANDARD.decode(cursor))
        .map_err(|_| ApiError::InvalidCursor("Invalid base64 encoding in cursor".to_string()))?;

    let json_str = std::str::from_utf8(&decoded)
        .map_err(|_| ApiError::InvalidCursor("Invalid UTF-8 sequence in cursor".to_string()))?;

    #[derive(serde::Deserialize)]
    struct DecodedCursor {
        t: String,
        i: String,
    }

    let cursor_obj: DecodedCursor = serde_json::from_str(json_str)
        .map_err(|_| ApiError::InvalidCursor("Invalid JSON structure in cursor".to_string()))?;

    // Validate UUID format
    if Uuid::parse_str(&cursor_obj.i).is_err() {
        return Err(ApiError::InvalidCursor(
            "Invalid UUID in cursor".to_string(),
        ));
    }

    // Validate timestamp format
    if DateTime::parse_from_rfc3339(&cursor_obj.t).is_err() {
        return Err(ApiError::InvalidCursor(
            "Invalid timestamp format in cursor".to_string(),
        ));
    }

    Ok(())
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
        let addr = format!("G{}", "A".repeat(55));
        assert!(matches!(
            validate_account_id(&addr).unwrap_err(),
            ApiError::InvalidFilter(_)
        ));
    }

    #[test]
    fn rejects_contract_address_shaped_string() {
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

    #[test]
    fn test_invalid_cursor_base64_decoding() {
        // Empty strings and whitespace
        assert!(matches!(
            validate_cursor("").unwrap_err(),
            ApiError::InvalidCursor(_)
        ));
        assert!(matches!(
            validate_cursor("   ").unwrap_err(),
            ApiError::InvalidCursor(_)
        ));

        // Invalid base64 characters
        assert!(matches!(
            validate_cursor("not-valid-base64!!!").unwrap_err(),
            ApiError::InvalidCursor(_)
        ));

        // Corrupted padding / invalid symbols
        assert!(matches!(
            validate_cursor("===invalid===").unwrap_err(),
            ApiError::InvalidCursor(_)
        ));

        // Valid base64, but non-UTF8 byte sequence
        assert!(matches!(
            validate_cursor("/v4=").unwrap_err(),
            ApiError::InvalidCursor(_)
        ));

        // Valid base64, but not JSON
        assert!(matches!(
            validate_cursor("aGVsbG8=").unwrap_err(),
            ApiError::InvalidCursor(_)
        ));

        // Valid JSON, but missing required cursor fields
        assert!(matches!(
            validate_cursor("e30=").unwrap_err(),
            ApiError::InvalidCursor(_)
        ));
    }

    #[test]
    fn test_valid_cursor_base64_decoding() {
        let valid_json = serde_json::json!({
            "t": "2024-01-15T10:30:00Z",
            "i": "a1a2a3a4-b1b2-c1c2-d1d2-d3d4d5d6d7d8"
        });
        let encoded =
            base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(valid_json.to_string());
        assert!(validate_cursor(&encoded).is_ok());
    }
}
