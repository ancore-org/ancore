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

import { redactForLog } from '../messaging/redact';

type LogMeta = Record<string, unknown> | Error | unknown;

/** Keep a single redaction policy for all extension log output. */
function redact(meta: LogMeta): LogMeta {
  return redactForLog('background-logger', meta) as LogMeta;
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
