/**
 * Tests for routeRateLimiter.ts
 *
 * Covers:
 *  - Config map: expected rpm for each named route
 *  - DEFAULT_ROUTE_CONFIG: applied for unknown routes
 *  - createRouteRateLimiter: allows requests up to the limit, blocks (limit+1)th
 *  - Per-route isolation: different routes maintain independent counters
 *  - Per-account isolation: different account keys have independent counters
 *  - Response headers: RateLimit-* draft headers present on allowed requests
 *  - 429 body: includes error, route, retryAfter on blocked requests
 *  - Override: rpm override takes precedence over the config map entry
 *  - resolveRouteConfig: returns correct merged config for tests/introspection
 */

import express from 'express';
import request from 'supertest';

import {
  ROUTE_RATE_LIMIT_CONFIG,
  DEFAULT_ROUTE_CONFIG,
  createRouteRateLimiter,
  resolveRouteConfig,
} from '../routeRateLimiter';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildApp(route: string, rpm: number) {
  const app = express();
  app.use(express.json());
  app.post(route, createRouteRateLimiter(route, { rpm }), (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

function buildMultiRouteApp(routes: Array<{ path: string; rpm: number }>) {
  const app = express();
  app.use(express.json());
  for (const { path, rpm } of routes) {
    app.post(path, createRouteRateLimiter(path, { rpm }), (_req, res) => {
      res.status(200).json({ ok: true });
    });
  }
  return app;
}

const SESSION_KEY_A = 'a'.repeat(64);
const SESSION_KEY_B = 'b'.repeat(64);

// ─── Config map ───────────────────────────────────────────────────────────────

describe('ROUTE_RATE_LIMIT_CONFIG', () => {
  it('contains an entry for /relay/execute with rpm 30', () => {
    expect(ROUTE_RATE_LIMIT_CONFIG['/relay/execute']?.rpm).toBe(30);
  });

  it('contains an entry for /relay/validate with rpm 60', () => {
    expect(ROUTE_RATE_LIMIT_CONFIG['/relay/validate']?.rpm).toBe(60);
  });

  it('contains an entry for /relay/session-key with rpm 10 (stricter)', () => {
    expect(ROUTE_RATE_LIMIT_CONFIG['/relay/session-key']?.rpm).toBe(10);
  });

  it('contains an entry for /relay/revoke-session-key with rpm 10 (stricter)', () => {
    expect(ROUTE_RATE_LIMIT_CONFIG['/relay/revoke-session-key']?.rpm).toBe(10);
  });

  it('contains an entry for /relay/status with rpm 120 (permissive)', () => {
    expect(ROUTE_RATE_LIMIT_CONFIG['/relay/status']?.rpm).toBe(120);
  });

  it('contains an entry for /health with rpm 120 (permissive)', () => {
    expect(ROUTE_RATE_LIMIT_CONFIG['/health']?.rpm).toBe(120);
  });

  it('session-key routes are stricter than the execute route', () => {
    expect(ROUTE_RATE_LIMIT_CONFIG['/relay/session-key']!.rpm).toBeLessThan(
      ROUTE_RATE_LIMIT_CONFIG['/relay/execute']!.rpm
    );
    expect(ROUTE_RATE_LIMIT_CONFIG['/relay/revoke-session-key']!.rpm).toBeLessThan(
      ROUTE_RATE_LIMIT_CONFIG['/relay/execute']!.rpm
    );
  });

  it('monitoring routes are more permissive than execute', () => {
    expect(ROUTE_RATE_LIMIT_CONFIG['/relay/status']!.rpm).toBeGreaterThan(
      ROUTE_RATE_LIMIT_CONFIG['/relay/execute']!.rpm
    );
    expect(ROUTE_RATE_LIMIT_CONFIG['/health']!.rpm).toBeGreaterThan(
      ROUTE_RATE_LIMIT_CONFIG['/relay/execute']!.rpm
    );
  });
});

// ─── DEFAULT_ROUTE_CONFIG ─────────────────────────────────────────────────────

describe('DEFAULT_ROUTE_CONFIG', () => {
  it('has an rpm value', () => {
    expect(typeof DEFAULT_ROUTE_CONFIG.rpm).toBe('number');
    expect(DEFAULT_ROUTE_CONFIG.rpm).toBeGreaterThan(0);
  });

  it('is more conservative than the execute route (fail-safe default)', () => {
    expect(DEFAULT_ROUTE_CONFIG.rpm).toBeLessThanOrEqual(
      ROUTE_RATE_LIMIT_CONFIG['/relay/execute']!.rpm
    );
  });
});

// ─── resolveRouteConfig ───────────────────────────────────────────────────────

describe('resolveRouteConfig', () => {
  it('returns the config map entry for a known route', () => {
    const cfg = resolveRouteConfig('/relay/session-key');
    expect(cfg.rpm).toBe(10);
    expect(cfg.windowMs).toBe(60_000);
  });

  it('returns DEFAULT_ROUTE_CONFIG for an unknown route', () => {
    const cfg = resolveRouteConfig('/relay/unknown-endpoint');
    expect(cfg.rpm).toBe(DEFAULT_ROUTE_CONFIG.rpm);
  });

  it('applies rpm override over the map entry', () => {
    const cfg = resolveRouteConfig('/relay/execute', { rpm: 5 });
    expect(cfg.rpm).toBe(5);
  });

  it('applies windowMs override', () => {
    const cfg = resolveRouteConfig('/relay/execute', { windowMs: 30_000 });
    expect(cfg.windowMs).toBe(30_000);
  });

  it('override does not mutate the config map', () => {
    resolveRouteConfig('/relay/execute', { rpm: 999 });
    expect(ROUTE_RATE_LIMIT_CONFIG['/relay/execute']?.rpm).toBe(30);
  });
});

// ─── Rate-limit enforcement ───────────────────────────────────────────────────

describe('createRouteRateLimiter – enforcement', () => {
  it('allows exactly rpm requests before blocking', async () => {
    const RPM = 3;
    const app = buildApp('/relay/execute', RPM);
    const body = { sessionKey: SESSION_KEY_A };

    for (let i = 0; i < RPM; i++) {
      const res = await request(app).post('/relay/execute').send(body);
      expect(res.status).toBe(200);
    }

    const blocked = await request(app).post('/relay/execute').send(body);
    expect(blocked.status).toBe(429);
  });

  it('returns the correct 429 body with error, route, and retryAfter', async () => {
    const RPM = 2;
    const app = buildApp('/relay/session-key', RPM);
    const body = { sessionKey: SESSION_KEY_A };

    for (let i = 0; i < RPM; i++) {
      await request(app).post('/relay/session-key').send(body);
    }

    const res = await request(app).post('/relay/session-key').send(body);
    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      error: 'RATE_LIMITED',
      route: '/relay/session-key',
      retryAfter: 60,
    });
  });

  it('applies a stricter limit to session-key than execute (config validation)', () => {
    const sessionCfg = resolveRouteConfig('/relay/session-key');
    const executeCfg = resolveRouteConfig('/relay/execute');
    expect(sessionCfg.rpm).toBeLessThan(executeCfg.rpm);
  });
});

// ─── Per-account isolation ────────────────────────────────────────────────────

describe('createRouteRateLimiter – per-account isolation', () => {
  it('different account keys have independent counters on the same route', async () => {
    const RPM = 2;
    const app = buildApp('/relay/execute', RPM);
    const bodyA = { sessionKey: SESSION_KEY_A };
    const bodyB = { sessionKey: SESSION_KEY_B };

    // Exhaust account A
    for (let i = 0; i < RPM; i++) {
      await request(app).post('/relay/execute').send(bodyA);
    }
    const blockedA = await request(app).post('/relay/execute').send(bodyA);
    expect(blockedA.status).toBe(429);

    // Account B should still have its own fresh quota
    const resB = await request(app).post('/relay/execute').send(bodyB);
    expect(resB.status).toBe(200);
  });
});

// ─── Per-route isolation ──────────────────────────────────────────────────────

describe('createRouteRateLimiter – per-route isolation', () => {
  it('exhausting one route does not affect a different route', async () => {
    const app = buildMultiRouteApp([
      { path: '/relay/execute', rpm: 2 },
      { path: '/relay/validate', rpm: 5 },
    ]);
    const body = { sessionKey: SESSION_KEY_A };

    // Exhaust /relay/execute
    for (let i = 0; i < 2; i++) {
      await request(app).post('/relay/execute').send(body);
    }
    const blockedExecute = await request(app).post('/relay/execute').send(body);
    expect(blockedExecute.status).toBe(429);

    // /relay/validate should be unaffected (different store bucket)
    const resValidate = await request(app).post('/relay/validate').send(body);
    expect(resValidate.status).toBe(200);
  });
});

// ─── Response headers ─────────────────────────────────────────────────────────

describe('createRouteRateLimiter – RateLimit headers', () => {
  it('sets RateLimit draft headers on successful responses', async () => {
    const RPM = 5;
    const app = buildApp('/relay/execute', RPM);
    const body = { sessionKey: SESSION_KEY_A };

    const res = await request(app).post('/relay/execute').send(body);
    expect(res.status).toBe(200);

    // express-rate-limit v7 standardHeaders emits ratelimit-* (lowercase) or
    // RateLimit-* — accept either casing
    const headerKeys = Object.keys(res.headers).map((k) => k.toLowerCase());
    const hasLimit = headerKeys.some((k) => k.includes('ratelimit-limit'));
    const hasRemaining = headerKeys.some((k) => k.includes('ratelimit-remaining'));
    expect(hasLimit).toBe(true);
    expect(hasRemaining).toBe(true);
  });

  it('does not emit legacy X-RateLimit-* headers', async () => {
    const RPM = 5;
    const app = buildApp('/relay/execute', RPM);
    const body = { sessionKey: SESSION_KEY_A };

    const res = await request(app).post('/relay/execute').send(body);
    const headerKeys = Object.keys(res.headers).map((k) => k.toLowerCase());
    const hasLegacy = headerKeys.some((k) => k.startsWith('x-ratelimit-'));
    expect(hasLegacy).toBe(false);
  });
});

// ─── Override behaviour ───────────────────────────────────────────────────────

describe('createRouteRateLimiter – override', () => {
  it('rpm override takes precedence over the config map', async () => {
    // The config map says execute = 30 rpm; we override to 2 in this test
    const RPM_OVERRIDE = 2;
    const app = buildApp('/relay/execute', RPM_OVERRIDE);
    const body = { sessionKey: SESSION_KEY_A };

    for (let i = 0; i < RPM_OVERRIDE; i++) {
      const res = await request(app).post('/relay/execute').send(body);
      expect(res.status).toBe(200);
    }
    const blocked = await request(app).post('/relay/execute').send(body);
    expect(blocked.status).toBe(429);
  });

  it('unknown route falls back to DEFAULT_ROUTE_CONFIG', async () => {
    const cfg = resolveRouteConfig('/relay/totally-new-route');
    expect(cfg.rpm).toBe(DEFAULT_ROUTE_CONFIG.rpm);
  });
});
