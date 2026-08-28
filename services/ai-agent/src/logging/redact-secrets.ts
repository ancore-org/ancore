/**
 * Redacts secret-shaped substrings from free-text before it reaches any log
 * sink. This is deliberately conservative — it is safer to over-redact a
 * false positive than to leak a real credential into audit logs.
 *
 * Distinct from `redactForLog` in ./logger.ts, which wipes entire fields by
 * key name (e.g. any field literally named "prompt"). This module instead
 * scans free text *content* for secret-shaped patterns so a partially-safe
 * prompt can still be logged for audit purposes with only the sensitive
 * spans removed.
 */

const REDACTED = '[REDACTED]';

/** Stellar secret seeds: "S" followed by 55 base32 (RFC4648, A-Z2-7) characters. */
const STELLAR_SECRET_KEY_RE = /\bS[A-Z2-7]{55}\b/g;

/**
 * API-key-shaped tokens: common vendor prefixes (Anthropic, OpenAI, GitHub,
 * Slack, AWS) plus a generic "Bearer <token>" form.
 */
const API_KEY_RE =
  /\b(?:sk-ant-[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9_-]{16,}|gh[oprsu]_[A-Za-z0-9]{20,}|xox[abp]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|Bearer\s+[A-Za-z0-9._-]{10,})\b/gi;

/**
 * Seed / recovery phrases: 12 or more consecutive lowercase alphabetic words.
 * BIP-39 phrases are always 12/15/18/21/24 words, but we redact any run of
 * 12+ to stay conservative against partial or non-standard phrases.
 */
const SEED_PHRASE_RE = /\b(?:[a-z]{3,10}\s+){11,}[a-z]{3,10}\b/g;

/**
 * Redacts Stellar secret keys, seed phrases, and API-key-shaped tokens from
 * a string, replacing each match with "[REDACTED]". Non-string input is
 * returned unchanged.
 */
export function redactSecrets(text: string): string {
  if (typeof text !== 'string' || text.length === 0) {
    return text;
  }

  return text
    .replace(STELLAR_SECRET_KEY_RE, REDACTED)
    .replace(API_KEY_RE, REDACTED)
    .replace(SEED_PHRASE_RE, REDACTED);
}
