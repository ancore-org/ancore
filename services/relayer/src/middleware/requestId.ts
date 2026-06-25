import { RequestHandler } from 'express';

const HEADER = 'x-request-id';

function isUuidV4(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isAllowedToken(value: string): boolean {
  // Allow short alphanum tokens with - _ . up to reasonable length
  return /^[A-Za-z0-9_.-]{8,128}$/.test(value);
}

export function createRequestIdMiddleware(): RequestHandler {
  return (req, res, next) => {
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
      // Prefer crypto.randomUUID when available
      try {
        // @ts-ignore
        id = typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function' ? (crypto as any).randomUUID() : undefined;
      } catch {
        id = undefined;
      }
      if (!id) id = Math.random().toString(36).slice(2, 12);
    }

    // Expose on request and response header
    (req as any).requestId = id;
    res.setHeader('X-Request-Id', id);

    next();
  };
}

export default createRequestIdMiddleware;
