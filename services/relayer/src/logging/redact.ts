/**
 * Log redaction helpers for the Relayer service.
 *
 * Public keys and signed payloads must never appear in full in logs.
 * These helpers truncate sensitive values to a safe prefix so that
 * log entries remain useful for debugging without leaking key material.
 *
 * Redaction policy
 * ─────────────────
 * - Public keys (64-char hex Ed25519):  show first 8 chars + "…[REDACTED]"
 * - Signatures (128-char hex):          show first 8 chars + "…[REDACTED]"
 * - Signed payloads / XDR blobs:        replaced entirely with "[REDACTED]"
 * - Bearer tokens / secrets:            replaced entirely with "[REDACTED]"
 *
 * Usage
 * ─────
 * import { redactPublicKey, redactSignedPayload, redactSecret } from './logging/redact';
 *
 * log.info({ from: redactPublicKey(from), to: redactPublicKey(to) }, 'relay_execute');
 */

/** Number of leading characters to keep when showing a partial key. */
const KEY_PREVIEW_LENGTH = 8;

/**
 * Redact an Ed25519 public key (or any 64-char hex session key).
 * Returns the first {@link KEY_PREVIEW_LENGTH} characters followed by "…[REDACTED]".
 *
 * @example
 * redactPublicKey('aabbccdd' + 'x'.repeat(56))
 * // → 'aabbccdd…[REDACTED]'
 */
export function redactPublicKey(key: string): string {
  if (!key || typeof key !== 'string') return '[REDACTED]';
  return `${key.slice(0, KEY_PREVIEW_LENGTH)}…[REDACTED]`;
}

/**
 * Redact an Ed25519 signature (128-char hex) or any hex-encoded signature blob.
 * Returns the first {@link KEY_PREVIEW_LENGTH} characters followed by "…[REDACTED]".
 */
export function redactSignature(sig: string): string {
  if (!sig || typeof sig !== 'string') return '[REDACTED]';
  return `${sig.slice(0, KEY_PREVIEW_LENGTH)}…[REDACTED]`;
}

/**
 * Redact a signed payload, XDR blob, or any opaque binary/base64 string.
 * The full value is replaced — no prefix is safe to expose.
 */
export function redactSignedPayload(_payload: string): string {
  return '[REDACTED]';
}

/**
 * Redact a secret value (Bearer token, API key, private key, etc.).
 * The full value is replaced — no prefix is safe to expose.
 */
export function redactSecret(_secret: string): string {
  return '[REDACTED]';
}

/**
 * Produce a safe log-friendly representation of a relay request body.
 * All sensitive fields are redacted; non-sensitive fields are passed through.
 *
 * @example
 * log.info(redactRelayRequest(req.body), 'relay_execute');
 */
export function redactRelayRequest(body: {
  sessionKey?: string;
  signature?: string;
  operation?: string;
  nonce?: number;
  parameters?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    sessionKey: body.sessionKey ? redactPublicKey(body.sessionKey) : undefined,
    signature: body.signature ? redactSignature(body.signature) : undefined,
    operation: body.operation,
    nonce: body.nonce,
    // parameters may contain signedTransactionXdr — redact it
    parameters: body.parameters ? redactParameters(body.parameters) : undefined,
  };
}

/**
 * Redact known sensitive keys inside a parameters map.
 * Unknown keys are passed through as-is.
 */
function redactParameters(params: Record<string, unknown>): Record<string, unknown> {
  const SENSITIVE_PARAM_KEYS = new Set(['signedTransactionXdr', 'privateKey', 'secret', 'token']);
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    result[k] = SENSITIVE_PARAM_KEYS.has(k) ? '[REDACTED]' : v;
  }
  return result;
}
