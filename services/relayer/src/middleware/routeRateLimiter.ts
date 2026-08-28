/**
 * routeRateLimiter.ts
 *
 * Per-route rate-limit configuration map and middleware factory for the
 * Ancore relayer service.
 *
 * Design decisions:
 * - All route limits are defined in one place (ROUTE_RATE_LIMIT_CONFIG) so
 *   reviewers can audit the full security surface in a single diff.
 * - Sensitive mutation routes (session-key add/revoke) get stricter defaults
 *   than the read/execute routes.
 * - A catch-all DEFAULT_ROUTE_CONFIG applies to any route not listed in the
 *   map, preventing an unconfigured route from being unlimited.
 * - Response headers follow the RateLimit-* draft spec (standardHeaders: true,
 *   legacyHeaders: false) so clients can read X-RateLimit-* headers.
 * - The keyGenerator uses the same account-resolution logic as the existing
 *   accountRateLimiter so per-route and per-account limiting compose cleanly.
 * - Storage is in-memory (express-rate-limit default). For multi-instance
 *   deployments swap in `rate-limit-redis` without changing this file.
 *
 * Usage:
 * ```typescript
 * import { createRouteRateLimiter } from './middleware/routeRateLimiter';
 *
 * // Mount before route handlers:
 * app.post('/relay/session-key', createRouteRateLimiter('/relay/session-key'), handler);
 *
 * // Or with a custom override (e.g. in tests):
 * app.post('/relay/execute', createRouteRateLimiter('/relay/execute', { rpm: 5 }), handler);
 * ```
 */

import rateLimit from 'express-rate-limit';
import type { Request, Response, RequestHandler } from 'express';

// ─── Route limit configuration ────────────────────────────────────────────────

/**
 * Per-route rate-limit parameters.
 *
 * `rpm`  – maximum requests per minute from the same account key.
 * `windowMs` – override the default 60-second window if needed (optional).
 */
export interface RouteRateLimitConfig {
  /** Requests per minute allowed per account key. */
  rpm: number;
  /** Sliding window in milliseconds (default: 60 000). */
  windowMs?: number;
}

/**
 * Central per-route rate-limit config map.
 *
 * Sensitive mutation routes (session-key management) are stricter than the
 * general execute/read routes to limit the blast radius of credential abuse.
 *
 * Defaults rationale:
 * | Route                       | rpm | Rationale                              |
 * |-----------------------------|-----|----------------------------------------|
 * | /relay/execute              |  30 | Normal operation; matches global floor |
 * | /relay/validate             |  60 | Read-only probe; twice as permissive   |
 * | /relay/session-key          |  10 | Sensitive: adds credentials            |
 * | /relay/revoke-session-key   |  10 | Sensitive: removes credentials         |
 * | /relay/status               | 120 | Health/monitoring; very permissive     |
 * | /health                     | 120 | Health/monitoring; very permissive     |
 */
export const ROUTE_RATE_LIMIT_CONFIG: Record<string, RouteRateLimitConfig> = {
  '/relay/execute': { rpm: 30 },
  '/relay/validate': { rpm: 60 },
  '/relay/session-key': { rpm: 10 },
  '/relay/revoke-session-key': { rpm: 10 },
  '/relay/status': { rpm: 120 },
  '/health': { rpm: 120 },
};

/**
 * Fallback config applied to any route not explicitly listed above.
 * Conservative: 20 rpm — stricter than execute to fail safely.
 */
export const DEFAULT_ROUTE_CONFIG: RouteRateLimitConfig = { rpm: 20 };

/**
 * Routes that do not carry account or session credentials in their request body.
 * These endpoints are keyed by client IP rather than account key to prevent all
 * callers from collapsing into and exhausting a single shared 'unknown' bucket.
 */
export const IP_KEYED_ROUTES = new Set(['/health', '/relay/status']);

// ─── Account key resolver (mirrors accountRateLimiter.ts) ────────────────────

/**
 * Derives a stable per-account rate-limit key from the request body.
 *
 * Resolution order (first truthy value wins):
 *   1. req.body.sender
 *   2. req.body.parameters.sender
 *   3. req.body.parameters.account
 *   4. req.body.parameters.contractAddress
 *   5. req.body.sessionKey  (primary identity in current relay schema)
 *   6. 'unknown'
 *
 * We deliberately do NOT fall back to IP for account-scoped routes — the existing
 * global IP-based limiter already covers that layer; mixing the two in the same
 * keyGenerator causes express-rate-limit v7 IPv6 validation errors.
 * Routes without account context (/health, /relay/status) use dedicated IP keying
 * via IP_KEYED_ROUTES to avoid sharing a single 'unknown' bucket across distinct clients.
 */
function resolveAccountKey(req: Request): string {
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

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a route-specific rate-limit middleware.
 *
 * Looks up `route` in {@link ROUTE_RATE_LIMIT_CONFIG}; falls back to
 * {@link DEFAULT_ROUTE_CONFIG} for unknown routes. The caller may supply
 * `override` to further customise (useful in tests or feature flags).
 *
 * Response headers set by this middleware:
 *   RateLimit-Limit         – configured rpm
 *   RateLimit-Remaining     – remaining requests in the current window
 *   RateLimit-Reset         – UTC epoch seconds when the window resets
 *
 * On limit exceeded: HTTP 429 with JSON body
 *   `{ error: 'RATE_LIMITED', route: '<route>', retryAfter: <windowSecs> }`
 *
 * @param route   Express-style route path (e.g. '/relay/session-key')
 * @param override Optional partial config that takes precedence over the map entry
 */
export function createRouteRateLimiter(
  route: string,
  override?: Partial<RouteRateLimitConfig>
): RequestHandler {
  const base = ROUTE_RATE_LIMIT_CONFIG[route] ?? DEFAULT_ROUTE_CONFIG;
  const resolved: RouteRateLimitConfig = {
    rpm: override?.rpm ?? base.rpm,
    windowMs: override?.windowMs ?? base.windowMs ?? 60_000,
  };

  const windowMs = resolved.windowMs!;
  const isIpKeyed = IP_KEYED_ROUTES.has(route);

  return rateLimit({
    windowMs,
    limit: resolved.rpm,
    standardHeaders: true, // emits RateLimit-* draft headers
    legacyHeaders: false, // suppresses deprecated X-RateLimit-* headers
    keyGenerator: isIpKeyed ? (req: Request) => req.ip || 'unknown' : resolveAccountKey,
    handler(_req: Request, res: Response) {
      res.status(429).json({
        error: 'RATE_LIMITED',
        route,
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
  });
}

/**
 * Returns the effective {@link RouteRateLimitConfig} for a given route,
 * applying any override, without constructing a middleware instance.
 * Useful for introspection and assertions in tests.
 */
export function resolveRouteConfig(
  route: string,
  override?: Partial<RouteRateLimitConfig>
): RouteRateLimitConfig {
  const base = ROUTE_RATE_LIMIT_CONFIG[route] ?? DEFAULT_ROUTE_CONFIG;
  return {
    rpm: override?.rpm ?? base.rpm,
    windowMs: override?.windowMs ?? base.windowMs ?? 60_000,
  };
}
