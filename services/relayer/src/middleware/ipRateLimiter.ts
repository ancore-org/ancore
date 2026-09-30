/**
 * ipRateLimiter.ts
 *
 * Global and per-route IP-based rate-limiting middleware for the Ancore relayer service.
 * Protects against single-client denial-of-service and credential abuse across endpoints.
 */

import rateLimit from 'express-rate-limit';
import type { Request, Response, RequestHandler } from 'express';

/**
 * Extracts the client's IP address from request headers or socket.
 * Prioritizes `X-Forwarded-For` (first IP in multi-proxy chains), then `X-Real-IP`,
 * then Express `req.ip`, and falls back to socket remote address.
 */
export function extractClientIp(req: Request): string {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    const raw = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
    const firstIp = raw.split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  const xRealIp = req.headers['x-real-ip'];
  if (xRealIp) {
    const raw = Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
    const ip = raw.trim();
    if (ip) return ip;
  }

  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

export interface IpRateLimiterOptions {
  /** Maximum requests allowed per window per IP. Defaults to 100. */
  rpm?: number;
  /** Window size in milliseconds. Defaults to 60,000 (1 minute). */
  windowMs?: number;
  /** Optional custom message when rate limit is exceeded. */
  message?: string;
  /** Optional predicate to bypass rate limiting for certain requests (e.g., health probes). */
  skip?: (req: Request, res: Response) => boolean | Promise<boolean>;
}

export const DEFAULT_IP_RATE_LIMIT_RPM = 100;
export const DEFAULT_IP_RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Creates an Express middleware that enforces per-IP rate limiting.
 * Emits standard draft `RateLimit-*` headers and returns HTTP 429 when exceeded.
 */
export function createIpRateLimiterMiddleware(options?: IpRateLimiterOptions): RequestHandler {
  const windowMs = options?.windowMs ?? DEFAULT_IP_RATE_LIMIT_WINDOW_MS;
  const limit = options?.rpm ?? DEFAULT_IP_RATE_LIMIT_RPM;
  const message = options?.message ?? 'Too many requests from this IP, please try again later.';

  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true, // Emits RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset
    legacyHeaders: false, // Suppresses deprecated X-RateLimit-* headers
    validate: { xForwardedForHeader: false, default: true },
    keyGenerator: (req: Request) => extractClientIp(req),
    skip: options?.skip,
    handler(_req: Request, res: Response) {
      const retryAfterSecs = Math.ceil(windowMs / 1000);
      res.setHeader('Retry-After', String(retryAfterSecs));
      res.status(429).json({
        error: 'TOO_MANY_REQUESTS',
        message,
        retryAfter: retryAfterSecs,
      });
    },
  });
}
