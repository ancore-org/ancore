import type { Request, Response, NextFunction } from 'express';
import { createIdempotencyMiddleware } from '../../src/middleware/idempotency';
import { IdempotencyStore } from '../../src/store/idempotency';

describe('createIdempotencyMiddleware', () => {
  let store: IdempotencyStore;

  beforeEach(() => {
    store = new IdempotencyStore();
  });

  function createMockReq(headers: Record<string, string | undefined> = {}): Request {
    return {
      headers,
    } as unknown as Request;
  }

  function createMockRes(initialStatusCode = 200): Response & {
    jsonPayload?: unknown;
    statusCalls: number[];
  } {
    const res: any = {
      statusCode: initialStatusCode,
      statusCalls: [],
      status(code: number) {
        this.statusCode = code;
        this.statusCalls.push(code);
        return this;
      },
      json(body: unknown) {
        this.jsonPayload = body;
        return this;
      },
    };
    return res;
  }

  it('passes through when idempotency-key header is absent', () => {
    const middleware = createIdempotencyMiddleware(store);
    const req = createMockReq({});
    const res = createMockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(store.size()).toBe(0);
  });

  it('passes through when idempotency-key header is empty or whitespace', () => {
    const middleware = createIdempotencyMiddleware(store);
    const req = createMockReq({ 'idempotency-key': '   ' });
    const res = createMockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(store.size()).toBe(0);
  });

  it('caches successful 2xx responses (200, 201)', async () => {
    const middleware = createIdempotencyMiddleware(store);
    const req = createMockReq({ 'idempotency-key': 'key-200' });
    const res = createMockRes(200);
    const next = jest.fn();

    await middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Downstream handler sends JSON response
    res.json({ success: true, id: 'tx-1' });

    expect(store.get('key-200')).toEqual({
      statusCode: 200,
      body: { success: true, id: 'tx-1' },
    });
  });

  it('replays cached response on subsequent requests with identical key', async () => {
    const middleware = createIdempotencyMiddleware(store);
    store.set('replayed-key', {
      statusCode: 200,
      body: { txId: 'abc-123' },
    });

    const req = createMockReq({ 'idempotency-key': 'replayed-key' });
    const res = createMockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCalls).toEqual([200]);
    expect(res.jsonPayload).toEqual({ txId: 'abc-123' });
  });

  it('does NOT cache 4xx client error responses (issue #1265)', async () => {
    const middleware = createIdempotencyMiddleware(store);
    const req = createMockReq({ 'idempotency-key': 'failed-400-key' });
    const res = createMockRes(400);
    const next = jest.fn();

    await middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    res.json({ error: 'Validation failed' });

    expect(store.get('failed-400-key')).toBeUndefined();
  });

  it('does NOT cache 5xx server error responses and allows subsequent retry (issue #1265)', async () => {
    const middleware = createIdempotencyMiddleware(store);
    const key = 'transient-500-key';

    // First attempt fails with 500
    const req1 = createMockReq({ 'idempotency-key': key });
    const res1 = createMockRes(500);
    const next1 = jest.fn();

    await middleware(req1, res1, next1);
    expect(next1).toHaveBeenCalledTimes(1);

    res1.json({ error: 'Internal server error' });
    expect(store.get(key)).toBeUndefined();

    // Client retries with the same key; downstream handler must execute and can succeed
    const req2 = createMockReq({ 'idempotency-key': key });
    const res2 = createMockRes(200);
    const next2 = jest.fn();

    await middleware(req2, res2, next2);
    expect(next2).toHaveBeenCalledTimes(1);

    res2.json({ success: true, result: 'recovered' });
    expect(store.get(key)).toEqual({
      statusCode: 200,
      body: { success: true, result: 'recovered' },
    });
  });
});
