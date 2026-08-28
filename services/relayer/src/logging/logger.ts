/**
 * Structured Logger for the Relayer Service
 *
 * Provides a lightweight structured logging abstraction that:
 *  - Emits JSON-serialisable log objects to console.* (no external deps)
 *  - Supports child loggers with pre-bound fields (bindings)
 *  - Redacts sensitive fields (auth payloads, raw secrets)
 *  - Defines a stable field contract for ops tooling
 *
 * Field dictionary:
 *  service     — always "relayer"
 *  requestId   — UUID propagated from X-Request-Id header (#572)
 *  route       — "METHOD /path" string
 *  accountId   — caller identity, redacted to first 8 chars + "\u2026"
 *  durationMs  — elapsed time from request start to log emission
 *  outcome     — "success" | "error" | "validation_failed"
 *  sessionKey  — first 8 chars of the hex session key + "\u2026" (never full)
 *  operation   — relay operation type
 *  statusCode  — HTTP response status
 *
 * Issue #474
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Stable log fields — all optional except `message` */
export interface LogFields {
  service?: string;
  requestId?: string;
  route?: string;
  /** Redacted caller identity */
  accountId?: string;
  durationMs?: number;
  outcome?: 'success' | 'error' | 'validation_failed';
  /** Redacted session key prefix */
  sessionKey?: string;
  operation?: string;
  statusCode?: number;
  /** Arbitrary extra fields */
  [key: string]: unknown;
}

export interface Logger {
  debug(fields: LogFields, message: string): void;
  info(fields: LogFields, message: string): void;
  warn(fields: LogFields, message: string): void;
  error(fields: LogFields, message: string): void;
  /** Create a child logger with pre-bound fields */
  child(bindings: LogFields): Logger;
}

// ---------------------------------------------------------------------------
// Redaction helpers
// ---------------------------------------------------------------------------

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'authorization',
  'auth',
  'credential',
  'privateKey',
  'private_key',
  'signedXdr',
  'signed_xdr',
]);
const TRUNCATION_MARKER = '\u2026';

/**
 * Redacts known sensitive keys from a log fields object.
 * Does NOT recurse into nested objects to keep it fast.
 */
function redactFields(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Redacts an accountId to the first 8 characters followed by "\u2026".
 * Returns undefined if the input is falsy.
 */
export function redactAccountId(accountId: string | undefined): string | undefined {
  if (!accountId) return undefined;
  if (accountId.length <= 8) return accountId;
  return `${accountId.slice(0, 8)}${TRUNCATION_MARKER}`;
}

/**
 * Redacts a session key to the first 8 hex chars followed by "\u2026".
 * Returns undefined if the input is falsy.
 */
export function redactSessionKey(sessionKey: string | undefined): string | undefined {
  if (!sessionKey) return undefined;
  if (sessionKey.length <= 8) return sessionKey;
  return `${sessionKey.slice(0, 8)}${TRUNCATION_MARKER}`;
}

// ---------------------------------------------------------------------------
// Logger implementation
// ---------------------------------------------------------------------------

const SERVICE_NAME = 'relayer';

function emit(level: LogLevel, bindings: LogFields, fields: LogFields, message: string): void {
  const merged = redactFields({ ...bindings, ...fields });
  const entry = {
    level,
    service: SERVICE_NAME,
    ...merged,
    message,
    timestamp: new Date().toISOString(),
  };

  switch (level) {
    case 'debug':
      console.debug(entry);
      break;
    case 'info':
      console.info(entry);
      break;
    case 'warn':
      console.warn(entry);
      break;
    case 'error':
      console.error(entry);
      break;
  }
}

function createLoggerWithBindings(bindings: LogFields): Logger {
  return {
    debug: (fields, message) => emit('debug', bindings, fields, message),
    info: (fields, message) => emit('info', bindings, fields, message),
    warn: (fields, message) => emit('warn', bindings, fields, message),
    error: (fields, message) => emit('error', bindings, fields, message),
    child: (childBindings) => createLoggerWithBindings({ ...bindings, ...childBindings }),
  };
}

/**
 * Root logger — use `.child({ requestId, route })` to create request-scoped loggers.
 *
 * @example
 * const log = rootLogger.child({ requestId: req.headers['x-request-id'], route: 'POST /relay/execute' });
 * log.info({ durationMs, outcome: 'success' }, 'relay_execute_complete');
 */
export const rootLogger: Logger = createLoggerWithBindings({ service: SERVICE_NAME });

/**
 * Factory for creating a request-scoped child logger.
 * Automatically redacts accountId and sessionKey.
 */
export function createRequestLogger(bindings: {
  requestId?: string;
  route: string;
  accountId?: string;
  sessionKey?: string;
}): Logger {
  return rootLogger.child({
    requestId: bindings.requestId,
    route: bindings.route,
    accountId: redactAccountId(bindings.accountId),
    sessionKey: redactSessionKey(bindings.sessionKey),
  });
}
