import { Request, Response, NextFunction, RequestHandler } from 'express';
import { logger } from '../logging';

/**
 * Reason code emitted in logs when a request is rejected by the payload guard.
 */
export const PAYLOAD_TOO_LARGE_REASON = 'PAYLOAD_TOO_LARGE' as const;

/**
 * Default maximum request body size in bytes (512 KiB).
 * Override via the `RELAY_MAX_PAYLOAD_BYTES` environment variable.
 */
export const DEFAULT_MAX_PAYLOAD_BYTES = 512 * 1024; // 512 KiB

/**
 * Options accepted by `createPayloadGuardMiddleware`.
 */
export interface PayloadGuardOptions {
  /**
   * Maximum allowed Content-Length in bytes.
   * Requests that advertise or deliver a body larger than this are rejected
   * with HTTP 413 before any body parsing occurs.
   *
   * @default DEFAULT_MAX_PAYLOAD_BYTES (512 KiB)
   */
  maxBytes?: number;
}

/**
 * Resolve the effective max-payload limit from options → env → default.
 * Exported for unit testing.
 */
export function resolveMaxBytes(options?: PayloadGuardOptions): number {
  if (options?.maxBytes !== undefined) {
    return options.maxBytes;
  }
  const fromEnv = process.env['RELAY_MAX_PAYLOAD_BYTES'];
  if (fromEnv) {
    const parsed = parseInt(fromEnv, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_MAX_PAYLOAD_BYTES;
}

/**
 * Express middleware factory that rejects requests whose body exceeds
 * `maxBytes`.
 *
 * The check fires against the `Content-Length` header **before** body
 * parsing, so oversized payloads are dropped at the earliest possible
 * point in the stack — preventing resource abuse from large allocations.
 *
 * On rejection the middleware:
 *  - Responds immediately with HTTP 413 and a structured JSON body.
 *  - Logs a structured warning with reason code `PAYLOAD_TOO_LARGE`.
 *
 * @example
 * ```ts
 * // Register early — before express.json()
 * app.use(createPayloadGuardMiddleware());
 * app.use(express.json());
 * ```
 */
export function createPayloadGuardMiddleware(options?: PayloadGuardOptions): RequestHandler {
  const maxBytes = resolveMaxBytes(options);

  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLengthHeader = req.headers['content-length'];

    if (contentLengthHeader !== undefined) {
      const contentLength = parseInt(contentLengthHeader, 10);

      if (!isNaN(contentLength) && contentLength > maxBytes) {
        logger.warn(
          {
            reason: PAYLOAD_TOO_LARGE_REASON,
            contentLength,
            maxBytes,
            path: req.path,
            method: req.method,
          },
          `Request payload of ${contentLength} bytes exceeds limit of ${maxBytes} bytes`
        );

        res.status(413).json({
          error: PAYLOAD_TOO_LARGE_REASON,
          message: `Request payload too large. Maximum allowed size is ${maxBytes} bytes.`,
        });
        return;
      }
    }

    next();
  };
}
