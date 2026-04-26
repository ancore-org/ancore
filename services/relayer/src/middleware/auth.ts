import { Request, Response, NextFunction } from 'express';
import type { AuthServiceContract } from '../types';

/**
 * Express middleware that enforces Bearer token authentication.
 *
 * Reads the `Authorization: Bearer <token>` header, delegates verification
 * to the injected `AuthServiceContract`, and attaches `callerId` to `res.locals`.
 *
 * Responds with 401 on missing/invalid tokens.
 */
export function createAuthMiddleware(authService: AuthServiceContract) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing Bearer token' });
      return;
    }

    const token = header.slice(7);
    try {
      const { callerId } = await authService.verifyToken(token);
      res.locals['callerId'] = callerId;
      next();
    } catch {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' });
    }
  };
}
