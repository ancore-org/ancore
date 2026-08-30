import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  count: number;
  resetTime: number;
}

const windowMs = 60 * 1000; // 1 minute window
const maxRequests = 60; // 60 requests per minute
const hits = new Map<string, RateLimitStore>();

// Clean up expired entries every 5 minutes to prevent memory leaks
setInterval(
  () => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(key);
      }
    }
  },
  5 * 60 * 1000
).unref();

export function draftIntentRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): void | Response {
  const key = `ip:${req.ip || 'unknown'}`;
  const now = Date.now();

  let record = hits.get(key);
  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + windowMs };
    hits.set(key, record);
    return next();
  }

  record.count += 1;
  if (record.count > maxRequests) {
    return res.status(429).json({
      error: 'Too many draft-intent requests. Rate limit exceeded.',
      retryAfterSeconds: Math.ceil((record.resetTime - now) / 1000),
    });
  }

  next();
}

export function _resetRateLimitStore(): void {
  hits.clear();
}
