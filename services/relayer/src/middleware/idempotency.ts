import { Request, Response, NextFunction } from 'express';
import type { IdempotencyStoreContract, AnyIdempotencyStore } from '../store/idempotency';
import { rootLogger } from '../logging';

/**
 * Express middleware that provides idempotency-key semantics for mutating
 * endpoints. Supports both in-memory and distributed Postgres-backed stores.
 *
 * Behaviour:
 *  - If the `idempotency-key` header is absent the request is passed through
 *    unchanged (idempotency is opt-in).
 *  - If the key is present and a cached response exists, the stored status
 *    code and body are replayed immediately — the downstream handler is
 *    never called.
 *  - If the key is present but no cache entry exists, the response is
 *    intercepted after the handler runs, stored under the key, then flushed
 *    normally.
 *
 * @example
 * ```ts
 * app.post('/relay/execute', auth, validate, createIdempotencyMiddleware(store), executeHandler);
 * ```
 */
export function createIdempotencyMiddleware(store: IdempotencyStoreContract | AnyIdempotencyStore) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawKey = req.headers['idempotency-key'];
      // Only accept a single string value; reject arrays.
      if (typeof rawKey !== 'string' || rawKey.trim() === '') {
        next();
        return;
      }

      const key = rawKey.trim();

      const cached = await store.get(key);
      if (cached) {
        // Replay the original response deterministically.
        res.status(cached.statusCode).json(cached.body);
        return;
      }


      // Intercept res.json to capture the outgoing response before it is sent.
      const originalJson = res.json.bind(res) as (body: unknown) => Response;
      res.json = function (body: unknown): Response {
        void Promise.resolve(store.set(key, { statusCode: res.statusCode, body })).catch((err) => {
          rootLogger.error(
            { error: err instanceof Error ? err.message : String(err) },
            'Failed to persist idempotency entry'
          );
        });
        return originalJson(body);
      };

    // Intercept res.json to capture the outgoing response before it is sent.
    const originalJson = res.json.bind(res) as (body: unknown) => Response;
    res.json = function (body: unknown): Response {
      // Only cache successful responses (2xx). Error responses (4xx/5xx) or transient
      // failures must not permanently poison the idempotency key for retries.
      if (res.statusCode >= 200 && res.statusCode < 300) {
        store.set(key, { statusCode: res.statusCode, body });
      }
      return originalJson(body);
    };


      next();
    } catch (err) {
      next(err);
    }
  };
}
