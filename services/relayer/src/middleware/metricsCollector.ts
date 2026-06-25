/**
 * Metrics Collector Middleware
 *
 * Records per-request latency into the relay_request_duration_seconds histogram
 * and increments relay_errors_total for any non-2xx response on /relay/* routes.
 *
 * Must be registered after createRequestLoggerMiddleware() so that req.startTime
 * is already set.
 *
 * Issue #675
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { relayLatency, relayErrors } from '../metrics';
import type { LoggedRequest } from './requestLogger';

const RELAY_PATH_PREFIX = '/relay/';

/**
 * Returns a middleware that instruments /relay/* routes with Prometheus metrics.
 */
export function createMetricsCollectorMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Only instrument relay routes
    if (!req.path.startsWith(RELAY_PATH_PREFIX)) {
      next();
      return;
    }

    res.on('finish', () => {
      const startMs = (req as LoggedRequest).startTime ?? Date.now();
      const durationSeconds = (Date.now() - startMs) / 1000;

      relayLatency.observe(durationSeconds);

      // Count errors: 4xx and 5xx responses
      if (res.statusCode >= 400) {
        // Use the error code from the response body if available via res.locals,
        // otherwise fall back to the HTTP status code string.
        const errorCode: string =
          (res.locals.relayErrorCode as string | undefined) ?? `HTTP_${res.statusCode}`;
        relayErrors.increment(errorCode);
      }
    });

    next();
  };
}
