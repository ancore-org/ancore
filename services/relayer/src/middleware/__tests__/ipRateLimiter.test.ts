import express from 'express';
import request from 'supertest';
import {
  createIpRateLimiterMiddleware,
  extractClientIp,
} from '../ipRateLimiter';

describe('extractClientIp', () => {
  it('extracts first IP from X-Forwarded-For comma-separated string', () => {
    const req = {
      headers: {
        'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178',
      },
    } as unknown as express.Request;

    expect(extractClientIp(req)).toBe('203.0.113.195');
  });

  it('extracts IP from X-Forwarded-For array', () => {
    const req = {
      headers: {
        'x-forwarded-for': ['198.51.100.1', '198.51.100.2'],
      },
    } as unknown as express.Request;

    expect(extractClientIp(req)).toBe('198.51.100.1');
  });

  it('extracts IP from X-Real-IP if X-Forwarded-For is absent', () => {
    const req = {
      headers: {
        'x-real-ip': '192.0.2.1',
      },
    } as unknown as express.Request;

    expect(extractClientIp(req)).toBe('192.0.2.1');
  });

  it('falls back to req.ip or socket.remoteAddress', () => {
    const req = {
      headers: {},
      ip: '10.0.0.1',
    } as unknown as express.Request;

    expect(extractClientIp(req)).toBe('10.0.0.1');

    const reqSocket = {
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as express.Request;

    expect(extractClientIp(reqSocket)).toBe('127.0.0.1');
  });
});

describe('createIpRateLimiterMiddleware', () => {
  function buildApp(rpm = 5, skip?: (req: express.Request) => boolean) {
    const app = express();
    app.set('trust proxy', true);
    app.use(createIpRateLimiterMiddleware({ rpm, skip }));
    app.get('/api/test', (_req, res) => {
      res.status(200).json({ ok: true });
    });
    app.get('/health', (_req, res) => {
      res.status(200).json({ status: 'ok' });
    });
    return app;
  }

  it('allows requests within limit and throttles requests exceeding limit', async () => {
    const RPM = 3;
    const app = buildApp(RPM);
    const clientIp = '198.51.100.10';

    for (let i = 0; i < RPM; i++) {
      const res = await request(app)
        .get('/api/test')
        .set('X-Forwarded-For', clientIp);
      expect(res.status).toBe(200);
      expect(res.headers['ratelimit-limit']).toBe(String(RPM));
      expect(res.headers['ratelimit-remaining']).toBe(String(RPM - 1 - i));
    }

    const limited = await request(app)
      .get('/api/test')
      .set('X-Forwarded-For', clientIp);

    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({
      error: 'TOO_MANY_REQUESTS',
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: 60,
    });
    expect(limited.headers['retry-after']).toBe('60');
  });

  it('isolates rate limits between different client IPs', async () => {
    const RPM = 2;
    const app = buildApp(RPM);
    const ipA = '192.168.1.1';
    const ipB = '192.168.1.2';

    // Exhaust IP A
    for (let i = 0; i < RPM; i++) {
      await request(app).get('/api/test').set('X-Forwarded-For', ipA);
    }
    const limitedA = await request(app)
      .get('/api/test')
      .set('X-Forwarded-For', ipA);
    expect(limitedA.status).toBe(429);

    // IP B is not affected
    const resB = await request(app)
      .get('/api/test')
      .set('X-Forwarded-For', ipB);
    expect(resB.status).toBe(200);
  });

  it('bypasses rate limiting when skip predicate returns true', async () => {
    const RPM = 1;
    const app = buildApp(RPM, (req) => req.path === '/health');
    const clientIp = '10.0.0.5';

    // First request uses quota on /api/test
    await request(app).get('/api/test').set('X-Forwarded-For', clientIp);

    // Second request on /api/test is rate-limited
    const limited = await request(app)
      .get('/api/test')
      .set('X-Forwarded-For', clientIp);
    expect(limited.status).toBe(429);

    // /health requests are skipped and succeed
    const health1 = await request(app)
      .get('/health')
      .set('X-Forwarded-For', clientIp);
    expect(health1.status).toBe(200);

    const health2 = await request(app)
      .get('/health')
      .set('X-Forwarded-For', clientIp);
    expect(health2.status).toBe(200);
  });
});
