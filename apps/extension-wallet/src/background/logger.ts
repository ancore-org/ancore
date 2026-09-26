/**
 * Structured background logger (#1026).
 *
 * Thin wrapper around console that:
 *  - Prefixes every message with a module tag.
 *  - Redacts common secret-looking keys in the first metadata argument.
 *  - Suppresses debug output in production builds.
 *
 * Usage:
 *   import { createLogger } from '@/background/logger';
 *   const log = createLogger('[ancore-extension/my-module]');
 *   log.info('wallet locked');
 *   log.warn('throttled', { retryAfterMs });
 *   log.error('failed', err);
 */

type LogMeta = Record<string, unknown> | Error | unknown;

/** Substrings matched case-insensitively against object keys before logging. */
const REDACTED_KEY_PATTERNS = [
  'password',
  'secret',
  'mnemonic',
  'privatekey',
  'seed',
  'token',
  'apikey',
];

function shouldRedactKey(key: string): boolean {
  const normalized = key.toLowerCase();
  if (normalized === 'key') return true;
  return REDACTED_KEY_PATTERNS.some((pattern) => normalized.includes(pattern));
}

/** Recursion cap so a pathologically deep (but non-circular) object can't blow the stack either. */
const MAX_REDACT_DEPTH = 20;

function redactValue(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (!value || typeof value !== 'object' || value instanceof Error) {
    return value;
  }

  if (depth >= MAX_REDACT_DEPTH) {
    return '<max-depth-exceeded>';
  }

  if (seen.has(value as object)) {
    return '<circular>';
  }
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, seen, depth + 1));
  }

  const safe: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    safe[key] = shouldRedactKey(key) ? '<redacted>' : redactValue(entry, seen, depth + 1);
  }
  return safe;
}

function redact(meta: LogMeta): LogMeta {
  return redactValue(meta, new WeakSet(), 0) as LogMeta;
}

export interface BackgroundLogger {
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
  debug(message: string, meta?: LogMeta): void;
}

export function createLogger(prefix: string): BackgroundLogger {
  return {
    info(message, meta?) {
      if (meta !== undefined) {
        console.info(`${prefix} ${message}`, redact(meta));
      } else {
        console.info(`${prefix} ${message}`);
      }
    },
    warn(message, meta?) {
      if (meta !== undefined) {
        console.warn(`${prefix} ${message}`, redact(meta));
      } else {
        console.warn(`${prefix} ${message}`);
      }
    },
    error(message, meta?) {
      if (meta !== undefined) {
        console.error(`${prefix} ${message}`, redact(meta));
      } else {
        console.error(`${prefix} ${message}`);
      }
    },
    debug(message, meta?) {
      if (!import.meta.env.DEV) return;
      if (meta !== undefined) {
        console.debug(`${prefix} ${message}`, redact(meta));
      } else {
        console.debug(`${prefix} ${message}`);
      }
    },
  };
}
