//! Best-effort XDR decoding for Soroban event topics.
//!
//! `RawEvent.topics` is documented as "XDR base64-encoded SCVal entries" —
//! the shape Soroban RPC's `getEvents` actually returns — but
//! `classify_event()` in `canonical.rs` matches against plain strings like
//! `"transfer"`. Against a real RPC response every topic is a `Symbol`
//! ScVal (Soroban's convention for event-name/discriminant topics), which
//! XDR-decodes to exactly that short ASCII string. This module bridges the
//! two: [`decode_topic`] turns a base64 XDR topic into the plain string
//! `classify_event` expects.
//!
//! Decoding is best-effort and never fails outward: on any decode error, or
//! for an SCVal type this indexer doesn't have a plain-string reading for,
//! the *original* input is returned unchanged. Two reasons:
//!   1. It keeps this safe to call on every topic unconditionally, including
//!      ones some future/legacy path already handed us as plain text.
//!   2. `classify_event` degrading to `EventKind::Unknown` on an
//!      unrecognised topic (rather than this function panicking or a
//!      `Result` propagating out) matches the existing "misclassification
//!      isn't fatal, it's a data-quality signal" posture in this file —
//!      see `EventKind::Unknown`.

use stellar_xdr::curr::{Limited, Limits, ReadXdr, ScVal};

/// Maximum SCVal we'll attempt to decode — event topics are short
/// discriminants, not payloads; anything past a few hundred bytes of XDR is
/// either not a topic or malformed, so bound the read rather than let a
/// malicious/corrupt payload drive unbounded allocation.
const MAX_TOPIC_XDR_BYTES: usize = 4096;

/// Decode a single topic entry. `raw` is expected to be a base64-encoded XDR
/// `ScVal`, per the Soroban RPC `getEvents` response shape. Falls back to
/// returning `raw` unchanged if it isn't valid base64, isn't valid XDR, or
/// decodes to an SCVal variant this function doesn't have a plain-string
/// reading for.
pub fn decode_topic(raw: &str) -> String {
    let Ok(bytes) = base64_decode(raw) else {
        return raw.to_string();
    };
    if bytes.len() > MAX_TOPIC_XDR_BYTES {
        return raw.to_string();
    }

    let mut limited = Limited::new(bytes.as_slice(), Limits::none());
    match ScVal::read_xdr_to_end(&mut limited) {
        Ok(ScVal::Symbol(sym)) => sym.to_string(),
        Ok(ScVal::String(s)) => s.to_string(),
        _ => raw.to_string(),
    }
}

/// Decode an entire topic list in place, in order.
pub fn decode_topics(raw_topics: &[String]) -> Vec<String> {
    raw_topics.iter().map(|t| decode_topic(t)).collect()
}

fn base64_decode(input: &str) -> Result<Vec<u8>, base64::DecodeError> {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.decode(input)
}

#[cfg(test)]
mod tests {
    use super::*;
    use stellar_xdr::curr::{ScString, ScSymbol, StringM, WriteXdr};

    fn encode(val: &ScVal) -> String {
        use base64::Engine;
        let bytes = val.to_xdr(Limits::none()).expect("encode xdr");
        base64::engine::general_purpose::STANDARD.encode(bytes)
    }

    #[test]
    fn decodes_symbol_topic_to_plain_string() {
        let sym = ScVal::Symbol(ScSymbol("transfer".try_into().unwrap()));
        let encoded = encode(&sym);
        assert_eq!(decode_topic(&encoded), "transfer");
    }

    #[test]
    fn decodes_string_topic_to_plain_string() {
        let s = ScVal::String(ScString(StringM::try_from("session_key_added").unwrap()));
        let encoded = encode(&s);
        assert_eq!(decode_topic(&encoded), "session_key_added");
    }

    #[test]
    fn falls_back_to_original_on_non_base64_input() {
        // Existing plain-string test fixtures throughout this crate rely on
        // exactly this: a bare word like "transfer" is not valid base64 XDR
        // and must pass through unchanged, not error out.
        assert_eq!(decode_topic("transfer"), "transfer");
    }

    #[test]
    fn falls_back_to_original_on_valid_base64_invalid_xdr() {
        // "aGVsbG8=" is valid base64 ("hello") but not a valid ScVal.
        assert_eq!(decode_topic("aGVsbG8="), "aGVsbG8=");
    }

    #[test]
    fn falls_back_to_original_on_empty_string() {
        assert_eq!(decode_topic(""), "");
    }

    #[test]
    fn falls_back_to_original_for_unsupported_scval_variant() {
        // An i64 ScVal is valid XDR but not one of the two variants this
        // indexer treats as a plain-string topic.
        let encoded = encode(&ScVal::I64(42));
        assert_eq!(decode_topic(&encoded), encoded);
    }

    #[test]
    fn oversized_payload_falls_back_without_attempting_to_decode() {
        use base64::Engine;
        let huge =
            base64::engine::general_purpose::STANDARD.encode(vec![0u8; MAX_TOPIC_XDR_BYTES + 1]);
        assert_eq!(decode_topic(&huge), huge);
    }

    #[test]
    fn decode_topics_preserves_order_and_length() {
        let sym1 = encode(&ScVal::Symbol(ScSymbol("transfer".try_into().unwrap())));
        let sym2 = encode(&ScVal::Symbol(ScSymbol("native".try_into().unwrap())));
        let raw = vec![sym1, sym2, "already-plain".to_string()];

        let decoded = decode_topics(&raw);

        assert_eq!(decoded, vec!["transfer", "native", "already-plain"]);
    }

    #[test]
    fn decode_topics_empty_list_returns_empty() {
        assert_eq!(decode_topics(&[]), Vec::<String>::new());
    }
}
