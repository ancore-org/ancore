/** Client-facing message used when a storage error would leak SQL details. */
export const INTERNAL_STORAGE_ERROR = 'Internal storage error';

/**
 * Postgres fragments that must never reach a client envelope.
 * Covers missing relations/columns and syntax failures from nonce and
 * idempotency queries.
 */
const SQL_DETAIL_PATTERNS: readonly RegExp[] = [
  /relation\s+\S[\s\S]*\sdoes not exist/i,
  /column\s+\S[\s\S]*\sdoes not exist/i,
  /syntax error at\b/i,
];

/**
 * Replace database error text with a generic storage message.
 * Non-SQL messages are returned unchanged.
 */
export function sanitizeErrorMessage(message: string): string {
  if (SQL_DETAIL_PATTERNS.some((pattern) => pattern.test(message))) {
    return INTERNAL_STORAGE_ERROR;
  }
  return message;
}
