/**
 * Shared log redaction for extension messaging.
 *
 * Used by the message sender/handler and the content script so a dev
 * `console.debug` never prints a plaintext password or other secret. The
 * background logger reuses the same helper instead of maintaining a second
 * list of sensitive keys.
 */

export const REDACTED_VALUE = '[redacted]';

/** Substrings matched case-insensitively against object keys before logging. */
const REDACTED_KEY_PATTERNS = [
  'password',
  'secret',
  'mnemonic',
  'privatekey',
  'seed',
  'token',
  'apikey',
  'xdr',
] as const;

/**
 * Fields that are sensitive for a specific message type even when their key
 * would not match the generic patterns above. Keyed by message type name.
 */
const SENSITIVE_FIELDS_BY_TYPE: Record<string, readonly string[]> = {
  UNLOCK_WALLET: ['password'],
  SIGN_TRANSACTION: ['xdr', 'signedXdr'],
  EXTERNAL_SIGN_TRANSACTION: ['xdr', 'signedXdr'],
  EXTERNAL_SIGN_AUTH_ENTRY: ['authEntry', 'signedAuthEntry'],
};

/** Recursion cap so a deep or circular payload cannot blow the stack. */
const MAX_REDACT_DEPTH = 20;

function shouldRedactKey(key: string, type: string): boolean {
  const normalized = key.toLowerCase();

  if (SENSITIVE_FIELDS_BY_TYPE[type]?.some((field) => field.toLowerCase() === normalized)) {
    return true;
  }

  if (normalized === 'key') return true;

  return REDACTED_KEY_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function redactValue(value: unknown, type: string, seen: WeakSet<object>, depth: number): unknown {
  if (!value || typeof value !== 'object' || value instanceof Error) {
    return value;
  }

  if (depth >= MAX_REDACT_DEPTH) {
    return '<max-depth-exceeded>';
  }

  if (seen.has(value)) {
    return '<circular>';
  }
  seen.add(value);

  let safe: unknown;
  if (Array.isArray(value)) {
    safe = value.map((entry) => redactValue(entry, type, seen, depth + 1));
  } else {
    const redacted: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      redacted[key] = shouldRedactKey(key, type)
        ? REDACTED_VALUE
        : redactValue(entry, type, seen, depth + 1);
    }
    safe = redacted;
  }

  // Only ancestors count as circular. A shared object reached through sibling
  // paths is safe to log and should be redacted fully on each path.
  seen.delete(value);
  return safe;
}

/**
 * Returns a redacted copy of `payload` suitable for console output.
 * The original payload is never mutated.
 */
export function redactForLog(type: string, payload: unknown): unknown {
  return redactValue(payload, type, new WeakSet(), 0);
}
