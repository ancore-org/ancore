import express from 'express';
import request from 'supertest';
import { createAccountRateLimiterMiddleware } from '../accountRateLimiter';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildApp(rpm = 30) {
  const app = express();
  app.use(express.json());
  app.post('/test', createAccountRateLimiterMiddleware({ rpm }), (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createAccountRateLimiterMiddleware', () => {
  it('allows exactly rpm requests and blocks the (rpm+1)th from the same account', async () => {
    const RPM = 30;
    const app = buildApp(RPM);
    const body = { sessionKey: 'a'.repeat(64) };

    // First 30 requests should all succeed
    for (let i = 0; i < RPM; i++) {
      const res = await request(app).post('/test').send(body);
      expect(res.status).toBe(200);
    }

    // 31st request must be rate-limited
    const limited = await request(app).post('/test').send(body);
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: 'RATE_LIMITED', retryAfter: 60 });
  });

  it("does not apply one account's limit to a different account (per-account isolation)", async () => {
    const RPM = 30;
    const app = buildApp(RPM);
    const bodyA = { sessionKey: 'a'.repeat(64) };
    const bodyB = { sessionKey: 'b'.repeat(64) };

    // Exhaust account A's quota
    for (let i = 0; i < RPM; i++) {
      await request(app).post('/test').send(bodyA);
    }
    const limitedA = await request(app).post('/test').send(bodyA);
    expect(limitedA.status).toBe(429);

    // Account B should still be under its own quota
    const resB = await request(app).post('/test').send(bodyB);
    expect(resB.status).toBe(200);
  });
});
