import { Request, Response, NextFunction } from 'express';
import {
  createPayloadGuardMiddleware,
  resolveMaxBytes,
  DEFAULT_MAX_PAYLOAD_BYTES,
  PAYLOAD_TOO_LARGE_REASON,
} from '../payloadGuard';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(contentLength?: number): Request {
  return {
    headers: contentLength !== undefined ? { 'content-length': String(contentLength) } : {},
    path: '/relay/execute',
    method: 'POST',
  } as unknown as Request;
}

function makeRes() {
  const res = {
    _status: 200,
    _body: undefined as unknown,
    status(code: number) {
      this._status = code;
      return this;
    },
    json(body: unknown) {
      this._body = body;
      return this;
    },
  };
  return res;
}

// ── resolveMaxBytes ───────────────────────────────────────────────────────────

describe('resolveMaxBytes', () => {
  const originalEnv = process.env['RELAY_MAX_PAYLOAD_BYTES'];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env['RELAY_MAX_PAYLOAD_BYTES'];
    } else {
      process.env['RELAY_MAX_PAYLOAD_BYTES'] = originalEnv;
    }
  });

  it('returns the default when no option or env var is set', () => {
    delete process.env['RELAY_MAX_PAYLOAD_BYTES'];
    expect(resolveMaxBytes()).toBe(DEFAULT_MAX_PAYLOAD_BYTES);
  });

  it('prefers options.maxBytes over env var', () => {
    process.env['RELAY_MAX_PAYLOAD_BYTES'] = '9999';
    expect(resolveMaxBytes({ maxBytes: 1234 })).toBe(1234);
  });

  it('reads limit from RELAY_MAX_PAYLOAD_BYTES env var', () => {
    process.env['RELAY_MAX_PAYLOAD_BYTES'] = '2048';
    expect(resolveMaxBytes()).toBe(2048);
  });

  it('falls back to default when env var is not a valid number', () => {
    process.env['RELAY_MAX_PAYLOAD_BYTES'] = 'not-a-number';
    expect(resolveMaxBytes()).toBe(DEFAULT_MAX_PAYLOAD_BYTES);
  });

  it('falls back to default when env var is zero or negative', () => {
    process.env['RELAY_MAX_PAYLOAD_BYTES'] = '0';
    expect(resolveMaxBytes()).toBe(DEFAULT_MAX_PAYLOAD_BYTES);
    process.env['RELAY_MAX_PAYLOAD_BYTES'] = '-100';
    expect(resolveMaxBytes()).toBe(DEFAULT_MAX_PAYLOAD_BYTES);
  });
});

// ── createPayloadGuardMiddleware ──────────────────────────────────────────────

describe('createPayloadGuardMiddleware', () => {
  it('calls next() when Content-Length is within the limit', () => {
    const guard = createPayloadGuardMiddleware({ maxBytes: 1024 });
    const req = makeReq(512);
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    guard(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).toBe(200);
  });

  it('calls next() when Content-Length equals the limit exactly', () => {
    const guard = createPayloadGuardMiddleware({ maxBytes: 1024 });
    const req = makeReq(1024);
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    guard(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects with 413 when Content-Length exceeds the limit', () => {
    const guard = createPayloadGuardMiddleware({ maxBytes: 1024 });
    const req = makeReq(1025);
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    guard(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(413);
  });

  it('sets the correct error code in the 413 response body', () => {
    const guard = createPayloadGuardMiddleware({ maxBytes: 100 });
    const req = makeReq(9999);
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    guard(req, res as unknown as Response, next);

    expect((res._body as { error: string }).error).toBe(PAYLOAD_TOO_LARGE_REASON);
  });

  it('calls next() when Content-Length header is absent', () => {
    const guard = createPayloadGuardMiddleware({ maxBytes: 100 });
    const req = makeReq(); // no Content-Length
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    guard(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('uses the default limit when no options are provided', () => {
    const guard = createPayloadGuardMiddleware();
    const belowDefault = makeReq(DEFAULT_MAX_PAYLOAD_BYTES - 1);
    const aboveDefault = makeReq(DEFAULT_MAX_PAYLOAD_BYTES + 1);
    const res1 = makeRes();
    const res2 = makeRes();
    const next1 = jest.fn() as unknown as NextFunction;
    const next2 = jest.fn() as unknown as NextFunction;

    guard(belowDefault, res1 as unknown as Response, next1);
    guard(aboveDefault, res2 as unknown as Response, next2);

    expect(next1).toHaveBeenCalledTimes(1);
    expect(next2).not.toHaveBeenCalled();
    expect(res2._status).toBe(413);
  });

  it('respects a custom threshold supplied via options', () => {
    const guard = createPayloadGuardMiddleware({ maxBytes: 50 });
    const justOver = makeReq(51);
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    guard(justOver, res as unknown as Response, next);

    expect(res._status).toBe(413);
    expect(next).not.toHaveBeenCalled();
  });

  it('logs a warning with reason code on rejection', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const guard = createPayloadGuardMiddleware({ maxBytes: 100 });
    const req = makeReq(200);
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    guard(req, res as unknown as Response, next);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const loggedArg = warnSpy.mock.calls[0][0] as { reason: string };
    expect(loggedArg.reason).toBe(PAYLOAD_TOO_LARGE_REASON);

    warnSpy.mockRestore();
  });
});
