/**
 * Request Logger Middleware
 *
 * Attaches a request-scoped child logger to `req.log` and emits
 * structured start/complete log entries for every relay route.
 *
 * Fields logged:
 *  - requestId  — from X-Request-Id header (propagated per #572)
 *  - route      — "METHOD /path"
 *  - accountId  — from res.locals.callerId (set by auth middleware), redacted
 *  - durationMs — elapsed time from request start to response finish
 *  - statusCode — HTTP response status code
 *  - outcome    — "success" | "error"
 *
 * No raw secrets, auth payloads, or full session keys are logged.
 *
 * Issue #474
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { createRequestLogger, redactAccountId, type Logger } from '../logging';

export type LoggedRequest = Request & {
  log: Logger;
  /** Epoch milliseconds when the request was received */
  startTime: number;
};

/**
 * Creates the request logger middleware.
 *
 * Register this middleware early in the stack — after CORS but before auth —
 * so that all subsequent middleware and handlers can use `req.log`.
 *
 * @example
 * app.use(createRequestLoggerMiddleware());
 */
export function createRequestLoggerMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const loggedReq = req as LoggedRequest;
    const requestId = (req as any).requestId ?? (req.headers['x-request-id'] as string | undefined) ?? generateRequestId();

    loggedReq.startTime = Date.now();

    const route = `${req.method} ${req.path}`;

    // Attach logger — accountId not yet available (set by auth middleware later)
    loggedReq.log = createRequestLogger({ requestId, route });

    loggedReq.log.info({ requestId }, 'request_start');

    // Emit completion log when the response finishes
    res.on('finish', () => {
      const durationMs = Date.now() - loggedReq.startTime;
      const statusCode = res.statusCode;
      const outcome = statusCode < 400 ? 'success' : 'error';

      // Re-create logger with callerId if auth middleware populated it
      const callerId = res.locals['callerId'] as string | undefined;
      const completionLog = callerId
        ? loggedReq.log.child({ accountId: redactAccountId(callerId) })
        : loggedReq.log;

      completionLog.info({ durationMs, statusCode, outcome }, 'request_complete');
    });

    next();
  };
}

/** Generates a short random request ID when no X-Request-Id header is present */
function generateRequestId(): string {
  return Math.random().toString(36).slice(2, 10);
}
