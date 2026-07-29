import { Request, Response, NextFunction, RequestHandler } from 'express';
import {
  relayLatency,
  relayErrors,
  relayRequestTotal,
  relayMockMode,
  relayValidationFailures,
} from '../metrics';
import type { LoggedRequest } from './requestLogger';

const RELAY_PATH_PREFIX = '/relay/';

export function createMetricsCollectorMiddleware(mockMode?: boolean): RequestHandler {
  if (mockMode !== undefined) {
    relayMockMode.set(mockMode ? 1 : 0);
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.path.startsWith(RELAY_PATH_PREFIX)) {
      next();
      return;
    }

    const route = `${req.method} ${req.path}`;
    relayRequestTotal.increment(route);

    res.on('finish', () => {
      const startMs = (req as LoggedRequest).startTime ?? Date.now();
      const durationSeconds = (Date.now() - startMs) / 1000;

      relayLatency.observe(durationSeconds);

      if (res.statusCode >= 400) {
        const errorCode: string =
          (res.locals.relayErrorCode as string | undefined) ?? `HTTP_${res.statusCode}`;
        relayErrors.increment(errorCode);

        if (res.statusCode === 422) {
          relayValidationFailures.increment(errorCode);
        }
      }
    });

    next();
  };
}

export { relayMockMode };
