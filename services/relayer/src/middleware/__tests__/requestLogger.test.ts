/**
 * Tests for the request logger middleware.
 * Validates that structured log entries are emitted with correct fields.
 *
 * Issue #474
 */

import { Request, Response, NextFunction } from 'express';
import { createRequestLoggerMiddleware, type LoggedRequest } from '../requestLogger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'POST',
    path: '/relay/execute',
    headers: {},
    startTime: Date.now(),
    ...overrides,
  } as unknown as Request;
}

interface MockRes {
  locals: Record<string, unknown>;
  statusCode: number;
  _finishListeners: Array<() => void>;
  on(event: string, fn: () => void): void;
  finish(): void;
}

function makeRes(overrides: Partial<MockRes> = {}): MockRes {
  const listeners: Array<() => void> = [];
  return {
    locals: {},
    statusCode: 200,
    _finishListeners: listeners,
    on(_event: string, fn: () => void) {
      listeners.push(fn);
    },
    finish() {
      listeners.forEach((fn) => fn());
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createRequestLoggerMiddleware', () => {
  let infoSpy: jest.SpyInstance;

  beforeEach(() => {
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    infoSpy.mockRestore();
  });

  it('calls next()', () => {
    const middleware = createRequestLoggerMiddleware();
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    middleware(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('attaches req.log', () => {
    const middleware = createRequestLoggerMiddleware();
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    middleware(req, res as unknown as Response, next);

    const loggedReq = req as LoggedRequest;
    expect(loggedReq.log).toBeDefined();
    expect(typeof loggedReq.log.info).toBe('function');
    expect(typeof loggedReq.log.child).toBe('function');
  });

  it('emits request_start log on entry', () => {
    const middleware = createRequestLoggerMiddleware();
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    middleware(req, res as unknown as Response, next);

    const calls = infoSpy.mock.calls.map((c) => c[0] as Record<string, unknown>);
    const startLog = calls.find((c) => c['message'] === 'request_start');
    expect(startLog).toBeDefined();
  });

  it('emits request_complete log on response finish', () => {
    const middleware = createRequestLoggerMiddleware();
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    middleware(req, res as unknown as Response, next);
    res.finish();

    const calls = infoSpy.mock.calls.map((c) => c[0] as Record<string, unknown>);
    const completeLog = calls.find((c) => c['message'] === 'request_complete');
    expect(completeLog).toBeDefined();
    expect(typeof completeLog!['durationMs']).toBe('number');
    expect(completeLog!['statusCode']).toBe(200);
    expect(completeLog!['outcome']).toBe('success');
  });

  it('sets outcome to error for 4xx responses', () => {
    const middleware = createRequestLoggerMiddleware();
    const req = makeReq();
    const res = makeRes({ statusCode: 422 });
    const next = jest.fn() as unknown as NextFunction;

    middleware(req, res as unknown as Response, next);
    res.finish();

    const calls = infoSpy.mock.calls.map((c) => c[0] as Record<string, unknown>);
    const completeLog = calls.find((c) => c['message'] === 'request_complete');
    expect(completeLog!['outcome']).toBe('error');
    expect(completeLog!['statusCode']).toBe(422);
  });

  it('propagates X-Request-Id header into log fields', () => {
    const middleware = createRequestLoggerMiddleware();
    const req = makeReq({ headers: { 'x-request-id': 'test-req-id-123' } });
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    middleware(req, res as unknown as Response, next);

    const calls = infoSpy.mock.calls.map((c) => c[0] as Record<string, unknown>);
    const startLog = calls.find((c) => c['message'] === 'request_start');
    expect(startLog!['requestId']).toBe('test-req-id-123');
  });

  it('generates a requestId when X-Request-Id header is absent', () => {
    const middleware = createRequestLoggerMiddleware();
    const req = makeReq({ headers: {} });
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    middleware(req, res as unknown as Response, next);

    const calls = infoSpy.mock.calls.map((c) => c[0] as Record<string, unknown>);
    const startLog = calls.find((c) => c['message'] === 'request_start');
    expect(typeof startLog!['requestId']).toBe('string');
    expect((startLog!['requestId'] as string).length).toBeGreaterThan(0);
  });

  it('includes callerId (redacted) in completion log when set by auth middleware', () => {
    const middleware = createRequestLoggerMiddleware();
    const req = makeReq();
    const res = makeRes();
    res.locals['callerId'] = 'GBXXX123LONGACCOUNTID';
    const next = jest.fn() as unknown as NextFunction;

    middleware(req, res as unknown as Response, next);
    res.finish();

    const calls = infoSpy.mock.calls.map((c) => c[0] as Record<string, unknown>);
    const completeLog = calls.find((c) => c['message'] === 'request_complete');
    // accountId should be redacted
    expect(completeLog!['accountId']).toBe('GBXXX123…');
  });

  it('includes route in log fields', () => {
    const middleware = createRequestLoggerMiddleware();
    const req = makeReq({ method: 'POST', path: '/relay/validate' });
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    middleware(req, res as unknown as Response, next);

    const calls = infoSpy.mock.calls.map((c) => c[0] as Record<string, unknown>);
    const startLog = calls.find((c) => c['message'] === 'request_start');
    expect(startLog!['route']).toBe('POST /relay/validate');
  });
});
