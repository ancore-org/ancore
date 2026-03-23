/**
 * Retry helper with exponential backoff for @ancore/stellar
 */

import { RetryExhaustedError } from './errors';

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds (default: 1000) */
  baseDelayMs?: number;
  /** Whether to use exponential backoff (default: true) */
  exponential?: boolean;
  /** Optional function to determine if error is retryable */
  isRetryable?: (error: Error) => boolean;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'isRetryable'>> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  exponential: true,
};

/**
 * Sleep for a specified duration
 */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calculate delay for a given attempt using exponential backoff
 * Attempt 1: 1s, Attempt 2: 2s, Attempt 3: 4s
 */
export const calculateDelay = (
  attempt: number,
  baseDelayMs: number,
  exponential: boolean
): number => {
  if (!exponential) {
    return baseDelayMs;
  }
  return baseDelayMs * Math.pow(2, attempt - 1);
};

/**
 * Execute an async function with retry logic and exponential backoff
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns The result of the function if successful
 * @throws RetryExhaustedError if all retry attempts fail
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => fetchAccountData(publicKey),
 *   { maxRetries: 3, baseDelayMs: 1000 }
 * );
 * ```
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxRetries, baseDelayMs, exponential } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  const { isRetryable } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we've exhausted retries
      if (attempt > maxRetries) {
        throw new RetryExhaustedError(attempt, lastError);
      }

      // Check if error is retryable
      if (isRetryable && !isRetryable(lastError)) {
        throw lastError;
      }

      // Calculate and wait for delay before next attempt
      const delay = calculateDelay(attempt, baseDelayMs, exponential);
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw new RetryExhaustedError(maxRetries + 1, lastError);
}
