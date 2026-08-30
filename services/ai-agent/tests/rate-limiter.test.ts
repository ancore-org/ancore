import { Request, Response } from 'express';
import { draftIntentRateLimiter, _resetRateLimitStore } from '../src/middleware/rate-limiter';

describe('draftIntentRateLimiter', () => {
  beforeEach(() => {
    _resetRateLimitStore();
  });

  function createMockContext(ip: string = '127.0.0.1', accountId?: string) {
    const req = {
      ip,
      body: accountId ? { accountId } : {},
    } as unknown as Request;

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;

    const next = jest.fn();

    return { req, res, next };
  }

  it('allows requests within the 60 req/min limit', () => {
    for (let i = 0; i < 60; i++) {
      const { req, res, next } = createMockContext('192.168.1.1', 'ACC_1');
      draftIntentRateLimiter(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    }
  });

  it('blocks the 61st request from the same IP with 429', () => {
    for (let i = 0; i < 60; i++) {
      const { req, res, next } = createMockContext('192.168.1.1', 'ACC_1');
      draftIntentRateLimiter(req, res, next);
    }

    const { req, res, next } = createMockContext('192.168.1.1', 'ACC_1');
    draftIntentRateLimiter(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Too many draft-intent requests. Rate limit exceeded.',
      })
    );
  });

  it('prevents spoofing bypass via changing caller-supplied accountId', () => {
    // Caller sends 60 requests each with a different accountId
    for (let i = 0; i < 60; i++) {
      const { req, res, next } = createMockContext('10.0.0.5', `SPOOFED_ACC_${i}`);
      draftIntentRateLimiter(req, res, next);
      expect(next).toHaveBeenCalled();
    }

    // 61st request with yet another fake accountId from the same IP must still be blocked
    const { req, res, next } = createMockContext('10.0.0.5', 'NEW_SPOOFED_ACC');
    draftIntentRateLimiter(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('maintains independent rate limit counters for different IPs', () => {
    // Exhaust IP 1
    for (let i = 0; i < 60; i++) {
      const { req, res, next } = createMockContext('1.1.1.1', 'ACC_1');
      draftIntentRateLimiter(req, res, next);
    }
    const blocked = createMockContext('1.1.1.1', 'ACC_1');
    draftIntentRateLimiter(blocked.req, blocked.res, blocked.next);
    expect(blocked.res.status).toHaveBeenCalledWith(429);

    // IP 2 is unaffected
    const freshIp = createMockContext('2.2.2.2', 'ACC_1');
    draftIntentRateLimiter(freshIp.req, freshIp.res, freshIp.next);
    expect(freshIp.next).toHaveBeenCalled();
    expect(freshIp.res.status).not.toHaveBeenCalled();
  });
});
