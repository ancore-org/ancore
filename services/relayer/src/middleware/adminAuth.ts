import { Request, Response, NextFunction } from 'express';

const ADMIN_API_KEY = process.env['ADMIN_API_KEY'] ?? 'ancore-admin-key';

export function createAdminAuthMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers['x-admin-key'] as string | undefined;

    if (!header || header !== ADMIN_API_KEY) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Invalid or missing admin key' });
      return;
    }

    next();
  };
}
