import { Request, Response, NextFunction } from 'express';
import { log } from '../logging/logger';
import { redactSecrets } from '../logging/redact-secrets';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const route = req.originalUrl || req.url;

    // Attempt to extract intentType from body for telemetry if present
    const intentType = req.body?.type || req.body?.intentType || undefined;

    // Extract accountId if present
    const accountId = req.body?.accountId || undefined;

    // route/intentType/accountId are request-controlled strings. log.info
    // already strips whole fields named prompt/freeText via redactForLog,
    // but that's a field-name check — it never scans a surviving value's
    // *content* for secret-shaped substrings. Route through redactSecrets
    // here too, the same way server.ts already does for promptRedacted,
    // so a secret pasted into e.g. accountId doesn't reach logs verbatim.
    const logData: Record<string, any> = {
      route: redactSecrets(route),
      method: req.method,
      statusCode: res.statusCode,
      durationMs,
    };

    if (intentType) logData.intentType = redactSecrets(String(intentType));
    if (accountId) logData.accountId = redactSecrets(String(accountId));

    log.info(logData, 'request_complete');
  });

  next();
}
