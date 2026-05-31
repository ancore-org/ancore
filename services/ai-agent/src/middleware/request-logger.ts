import { Request, Response, NextFunction } from 'express';
import { log } from '../logging/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const route = req.originalUrl || req.url;

    // Attempt to extract intentType from body for telemetry if present
    const intentType = req.body?.type || req.body?.intentType || undefined;

    // Extract accountId if present
    const accountId = req.body?.accountId || undefined;

    const logData: Record<string, any> = {
      route,
      method: req.method,
      statusCode: res.statusCode,
      durationMs,
    };

    if (intentType) logData.intentType = intentType;
    if (accountId) logData.accountId = accountId;

    log.info(logData, 'request_complete');
  });

  next();
}
