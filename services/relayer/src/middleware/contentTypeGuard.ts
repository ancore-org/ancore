import { Request, Response, NextFunction, RequestHandler } from 'express';
import { rootLogger as logger } from '../logging';

/**
 * Reason code emitted when a request is rejected due to missing or unsupported Content-Type.
 */
export const UNSUPPORTED_MEDIA_TYPE_REASON = 'UNSUPPORTED_MEDIA_TYPE' as const;

/**
 * Express middleware factory that enforces `Content-Type: application/json` for incoming
 * HTTP requests with payload bodies (POST, PUT, PATCH).
 *
 * Requests that do not provide `application/json` in their `Content-Type` header are rejected
 * early with HTTP 415 (Unsupported Media Type) and a structured JSON payload.
 */
export function createContentTypeGuardMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const method = req.method.toUpperCase();
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      const contentType = req.headers['content-type'];
      if (!contentType || !contentType.toLowerCase().includes('application/json')) {
        logger.warn(
          {
            reason: UNSUPPORTED_MEDIA_TYPE_REASON,
            contentType: contentType ?? 'none',
            path: req.path,
            method: req.method,
          },
          `Request Content-Type "${contentType ?? 'none'}" is not application/json`
        );

        res.status(415).json({
          error: UNSUPPORTED_MEDIA_TYPE_REASON,
          message: 'Content-Type must be application/json',
        });
        return;
      }
    }

    next();
  };
}
