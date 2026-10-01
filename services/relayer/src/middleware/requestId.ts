import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { RequestHandler, Request, Response, NextFunction } from 'express';

const HEADER = 'x-request-id';

// Augment Express Request type to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

// AsyncLocalStorage for request-scoped context across async operations and logs
export const requestContext = new AsyncLocalStorage<{ requestId: string }>();

function isUuidV4(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isAllowedToken(value: string): boolean {
  // Allow short alphanum tokens with - _ . up to reasonable length
  return /^[A-Za-z0-9_.-]{8,128}$/.test(value);
}

/**
 * Creates Express middleware to validate/generate request IDs and maintain async context.
 */
export function createRequestIdMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.header(HEADER);
    let id: string | undefined = undefined;

    if (header) {
      // Validate client-supplied ID
      if (isUuidV4(header) || isAllowedToken(header)) {
        id = header;
      } else {
        res.status(400).json({ error: 'Invalid X-Request-Id header' });
        return;
      }
    }

    if (!id) {
      id = randomUUID();
    }

    // Expose on request and response headers (both lower-case and canonical)
    Object.assign(req, { requestId: id });
    res.setHeader('x-request-id', id);
    res.setHeader('X-Request-Id', id);

    requestContext.run({ requestId: id }, () => {
      next();
    });
  };
}

export const requestIdMiddleware = createRequestIdMiddleware();
export default createRequestIdMiddleware;
