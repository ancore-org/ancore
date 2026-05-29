/**
 * Structured logger for the Relayer service.
 *
 * Wraps the built-in console with a structured JSON interface so that
 * log entries are machine-parseable in production while remaining
 * readable in development.
 *
 * All log methods accept an optional context object (first argument)
 * and a required message string (second argument), mirroring the pino
 * API so the implementation can be swapped for pino later without
 * changing call sites.
 *
 * Sensitive values MUST be redacted before being passed to any logger
 * method. Use the helpers in `./redact` for this purpose.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(ctx: Record<string, unknown>, msg: string): void;
  info(ctx: Record<string, unknown>, msg: string): void;
  warn(ctx: Record<string, unknown>, msg: string): void;
  error(ctx: Record<string, unknown>, msg: string): void;
}

function emit(level: LogLevel, ctx: Record<string, unknown>, msg: string): void {
  const entry = JSON.stringify({ level, time: new Date().toISOString(), msg, ...ctx });
  if (level === 'error' || level === 'warn') {
    console.error(entry);
  } else {
    console.log(entry);
  }
}

/**
 * Default singleton logger. Import and use directly in service code.
 *
 * @example
 * import { logger } from '../logging/logger';
 * logger.info({ from: redactPublicKey(from) }, 'relay_execute');
 */
export const logger: Logger = {
  debug: (ctx, msg) => emit('debug', ctx, msg),
  info: (ctx, msg) => emit('info', ctx, msg),
  warn: (ctx, msg) => emit('warn', ctx, msg),
  error: (ctx, msg) => emit('error', ctx, msg),
};

/**
 * Create a child logger that merges a fixed context into every log entry.
 * Useful for adding a `service` or `requestId` field to all entries in a
 * request lifecycle.
 *
 * @example
 * const reqLog = childLogger(logger, { requestId: req.headers['x-request-id'] });
 * reqLog.info({}, 'request_received');
 */
export function childLogger(parent: Logger, fixedCtx: Record<string, unknown>): Logger {
  return {
    debug: (ctx, msg) => parent.debug({ ...fixedCtx, ...ctx }, msg),
    info: (ctx, msg) => parent.info({ ...fixedCtx, ...ctx }, msg),
    warn: (ctx, msg) => parent.warn({ ...fixedCtx, ...ctx }, msg),
    error: (ctx, msg) => parent.error({ ...fixedCtx, ...ctx }, msg),
  };
}
