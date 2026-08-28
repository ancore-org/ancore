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

/** Keys whose values are replaced with '<redacted>' before logging. */
const REDACTED_KEYS = new Set([
  'password',
  'secret',
  'mnemonic',
  'privateKey',
  'seed',
  'token',
  'key',
]);

function redact(meta: LogMeta): LogMeta {
  if (!meta || typeof meta !== 'object' || meta instanceof Error) return meta;
  const obj = meta as Record<string, unknown>;
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    safe[k] = REDACTED_KEYS.has(k) ? '<redacted>' : v;
  }
  return safe;
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
