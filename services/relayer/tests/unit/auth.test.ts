import { Request, Response, NextFunction } from 'express';
import { createAuthMiddleware } from '../../src/middleware/auth';
import type { AuthServiceContract } from '../../src/types';

function mockRes() {
  const res = { status: jest.fn(), json: jest.fn(), locals: {} } as unknown as Response;
  (res.status as jest.Mock).mockReturnValue(res);
  return res;
}

describe('createAuthMiddleware', () => {
  const next: NextFunction = jest.fn();

  const validAuth: AuthServiceContract = {
    verifyToken: jest.fn().mockResolvedValue({ callerId: 'user-1' }),
  };
  const invalidAuth: AuthServiceContract = {
    verifyToken: jest.fn().mockRejectedValue(new Error('bad token')),
  };

  beforeEach(() => jest.clearAllMocks());

  it('calls next and sets callerId on valid token', async () => {
    const req = { headers: { authorization: 'Bearer valid-token' } } as Request;
    const res = mockRes();
    await createAuthMiddleware(validAuth)(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.locals['callerId']).toBe('user-1');
  });

  it('returns 401 when Authorization header is missing', async () => {
    const req = { headers: {} } as Request;
    const res = mockRes();
    await createAuthMiddleware(validAuth)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token verification fails', async () => {
    const req = { headers: { authorization: 'Bearer bad-token' } } as Request;
    const res = mockRes();
    await createAuthMiddleware(invalidAuth)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when header is not Bearer scheme', async () => {
    const req = { headers: { authorization: 'Basic dXNlcjpwYXNz' } } as Request;
    const res = mockRes();
    await createAuthMiddleware(validAuth)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
