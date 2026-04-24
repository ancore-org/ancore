import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError } from 'zod';
import type { ValidationErrorResponse } from '../api/types';

/**
 * Formats a ZodError into a structured, typed error response.
 */
function formatZodError(err: ZodError): ValidationErrorResponse {
  return {
    error: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    details: err.errors.map((issue) => ({
      field: issue.path.join('.') || 'root',
      message: issue.message,
    })),
  };
}

/**
 * Express middleware factory that validates `req.body` against the provided Zod schema.
 *
 * On success, `req.body` is replaced with the parsed (coerced + stripped) value.
 * On failure, responds immediately with HTTP 400 and a `ValidationErrorResponse` body.
 *
 * @example
 * ```ts
 * router.post('/relay/execute', validateBody(relayExecuteRequestSchema), executeHandler);
 * ```
 */
export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errorResponse: ValidationErrorResponse = formatZodError(result.error);
      res.status(400).json(errorResponse);
      return;
    }

    // Replace body with fully-typed, coerced value
    req.body = result.data as Record<string, unknown>;
    next();
  };
}

/**
 * Validates a plain object (non-Express context) — useful for unit tests and CLI tools.
 *
 * @returns Parsed data on success, throws on failure.
 */
export function validateRequest<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw formatZodError(result.error);
  }
  return result.data;
}
