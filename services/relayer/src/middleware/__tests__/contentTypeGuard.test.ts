import { Request, Response, NextFunction } from 'express';
import {
  createContentTypeGuardMiddleware,
  UNSUPPORTED_MEDIA_TYPE_REASON,
} from '../contentTypeGuard';

function makeReq(method = 'POST', contentType?: string): Request {
  return {
    headers: contentType !== undefined ? { 'content-type': contentType } : {},
    path: '/relay/execute',
    method,
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

describe('createContentTypeGuardMiddleware', () => {
  it('calls next() for POST request with application/json Content-Type', () => {
    const guard = createContentTypeGuardMiddleware();
    const req = makeReq('POST', 'application/json');
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    guard(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).toBe(200);
  });

  it('calls next() for POST request with Content-Type containing parameters', () => {
    const guard = createContentTypeGuardMiddleware();
    const req = makeReq('POST', 'application/json; charset=utf-8');
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    guard(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('calls next() for GET requests without Content-Type', () => {
    const guard = createContentTypeGuardMiddleware();
    const req = makeReq('GET');
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    guard(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects POST request with text/plain Content-Type with HTTP 415', () => {
    const guard = createContentTypeGuardMiddleware();
    const req = makeReq('POST', 'text/plain');
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    guard(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(415);
    expect((res._body as { error: string }).error).toBe(UNSUPPORTED_MEDIA_TYPE_REASON);
  });

  it('rejects POST request with missing Content-Type header with HTTP 415', () => {
    const guard = createContentTypeGuardMiddleware();
    const req = makeReq('POST', undefined);
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    guard(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(415);
    expect((res._body as { error: string }).error).toBe(UNSUPPORTED_MEDIA_TYPE_REASON);
  });
});
