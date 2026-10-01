/**
 * Retry wrapper for AncoreClient network calls.
 *
 * Re-exports `withRetry` from `@ancore/stellar` so SDK consumers don't
 * need a separate import. Also provides `wrapWithRetry` — a higher-order
 * function that wraps any async method with configurable retry logic.
 *
 * @module retry-wrapper
 */

export { withRetry, type RetryOptions } from '@ancore/stellar';
export { RetryExhaustedError } from '@ancore/stellar';

import { withRetry, type RetryOptions } from '@ancore/stellar';
import { LOW_LATENCY, RELIABLE, AGGRESSIVE, getRetryPreset, type RetryPresetName } from './retry-presets';

/**
 * Default retry options for AncoreClient network calls.
 * Uses the AGGRESSIVE preset (4 retries, 500ms base, exponential).
 */
export const DEFAULT_CLIENT_RETRY: RetryOptions = AGGRESSIVE;

/**
 * Wrap an async function with retry logic.
 *
 * @param fn - The async function to wrap
 * @param options - Retry options (uses DEFAULT_CLIENT_RETRY if not provided)
 * @returns A new function that retries on failure
 *
 * @example
 * ```typescript
 * import { wrapWithRetry, RELIABLE } from '@ancore/core-sdk';
 *
 * const reliableFetch = wrapWithRetry(fetch, RELIABLE);
 * const response = await reliableFetch('https://api.example.com/data');
 * ```
 */
export function wrapWithRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: RetryOptions | RetryPresetName,
): T {
  const opts: RetryOptions =
    typeof options === 'string'
      ? getRetryPreset(options)
      : options ?? DEFAULT_CLIENT_RETRY;

  return ((...args: Parameters<T>) => withRetry(() => fn(...args), opts)) as T;
}

/**
 * Wrap all methods of an object with retry logic.
 *
 * Only wraps async methods (those returning a Promise).
 * Sync methods are left unchanged.
 *
 * @param obj - The object whose async methods should be wrapped
 * @param options - Retry options (uses DEFAULT_CLIENT_RETRY if not provided)
 * @returns A new object with wrapped async methods
 *
 * @example
 * ```typescript
 * import { wrapObjectWithRetry, LOW_LATENCY } from '@ancore/core-sdk';
 *
 * const client = new AncoreClient({ accountContractId: 'C...' });
 * const retriedClient = wrapObjectWithRetry(client, LOW_LATENCY);
 * // All async methods on retriedClient now retry on transient failures
 * ```
 */
export function wrapObjectWithRetry<T extends Record<string, any>>(
  obj: T,
  options?: RetryOptions | RetryPresetName,
): T {
  const opts: RetryOptions =
    typeof options === 'string'
      ? getRetryPreset(options)
      : options ?? DEFAULT_CLIENT_RETRY;

  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (typeof value === 'function') {
      // Check if it's async (returns a Promise)
      result[key] = (...args: any[]) => {
        const ret = value.apply(obj, args);
        if (ret && typeof ret.then === 'function') {
          return withRetry(() => ret, opts);
        }
        return ret;
      };
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

export { LOW_LATENCY, RELIABLE, AGGRESSIVE, getRetryPreset, type RetryPresetName };
