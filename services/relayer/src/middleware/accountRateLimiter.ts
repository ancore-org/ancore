import { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

/**
 * Resolves the per-account rate-limit (requests per minute) from options or env.
 *
 * Priority: options.rpm → RELAY_RATE_LIMIT_RPM env var → 30 (default).
 * Guards against NaN and non-positive values by falling back to 30.
 */
function resolveRpm(rpm?: number): number {
  if (rpm !== undefined && rpm > 0) return rpm;
  const fromEnv = Number(process.env.RELAY_RATE_LIMIT_RPM);
  if (!isNaN(fromEnv) && fromEnv > 0) return fromEnv;
  return 30;
}

/**
 * Derives a stable account key from the relay request body.
 *
 * Resolution order (first truthy value wins):
 *   1. req.body.sender              – explicit sender address (future schema extension)
 *   2. req.body.parameters.sender   – sender nested in parameters map
 *   3. req.body.parameters.account  – account nested in parameters map
 *   4. req.body.parameters.contractAddress – contract address as a proxy identity
 *   5. req.body.sessionKey          – the session key itself (always present per current schema)
 *   6. 'unknown'                    – last-resort stable fallback
 *
 * NOTE: The current relay request schema has NO top-level `sender` field.
 * `sessionKey` (a 64-hex string) is the primary session identity and is
 * almost always present after body parsing, making it the practical default.
 *
 * We deliberately do NOT fall back to IP — the existing `relayLimiter` already
 * covers IP-based limiting, and returning an IP from a custom keyGenerator
 * triggers express-rate-limit v7's IPv6-key validation error.
 *
 * TODO (scaling): Replace the default in-memory store with a Redis store
 * (e.g. `rate-limit-redis`) so limits are shared across multiple relayer
 * instances. The keyGenerator and handler below are store-agnostic.
 */
function deriveAccountKey(req: Request): string {
  const body = req.body as Record<string, unknown> | undefined;
  const params = (body?.['parameters'] ?? {}) as Record<string, unknown>;

  return (
    (body?.['sender'] as string | undefined) ??
    (params['sender'] as string | undefined) ??
    (params['account'] as string | undefined) ??
    (params['contractAddress'] as string | undefined) ??
    (body?.['sessionKey'] as string | undefined) ??
    'unknown'
  );
}

export interface AccountRateLimiterOptions {
  /** Requests per minute allowed per account. Defaults to 30 (or RELAY_RATE_LIMIT_RPM env var). */
  rpm?: number;
}

/**
 * Creates an Express middleware that enforces per-account rate limiting on
 * relay requests. Independent of the existing IP-based limiter.
 *
 * Default: 30 requests / minute / account. Configurable via `RELAY_RATE_LIMIT_RPM`.
 * Exceeding the limit yields HTTP 429 with `{ error: 'RATE_LIMITED', retryAfter: 60 }`.
 *
 * Storage: in-memory (express-rate-limit default). For multi-instance deployments,
 * swap in a Redis store via `rate-limit-redis`.
 */
export function createAccountRateLimiterMiddleware(options?: AccountRateLimiterOptions) {
  return rateLimit({
    windowMs: 60_000,
    limit: resolveRpm(options?.rpm),
    standardHeaders: true,
    legacyHeaders: false,
    // No validate overrides needed: our keyGenerator always returns a non-IP
    // string (hex session key or a named account address), so express-rate-limit
    // v7's IP validation never fires.
    keyGenerator: deriveAccountKey,
    handler(_req: Request, res: Response) {
      res.status(429).json({ error: 'RATE_LIMITED', retryAfter: 60 });
    },
  });
}
