/**
 * @ancore/core-sdk - Retry Policy Wrapper
 *
 * Provides configurable exponential backoff and retry mechanisms for AncoreClient
 * network calls and transient failure handling (network timeouts, 5xx server errors, rate limits).
 *
 * @module retry-policy
 */

import {
  RETRY_PRESETS as STELLAR_RETRY_PRESETS,
  RetryExhaustedError,
  type RetryOptions as StellarRetryOptions,
} from '@ancore/stellar';

import { InvalidRetryPresetError } from './errors';
import {
  AGGRESSIVE,
  LOW_LATENCY,
  RELIABLE,
  RETRY_PRESETS as CORE_RETRY_PRESETS,
  type RetryPresetName,
} from './retry-presets';

export interface RetryPolicyOptions {
  /** Maximum number of retry attempts after the initial failure. Default: 3. */
  maxRetries?: number;
  /** Initial base delay in milliseconds between retries. Default: 500. */
  baseDelayMs?: number;
  /** Upper bound ceiling for backoff delay in milliseconds. Default: 30,000. */
  maxDelayMs?: number;
  /** Whether to use exponential backoff (`delay = baseDelay * 2^(attempt-1)`). Default: true. */
  exponential?: boolean;
  /** Whether to add randomized jitter (+/- 20%) to avoid thundering herd spikes. Default: false. */
  jitter?: boolean;
  /** Predicate function determining if an error should trigger a retry. Defaults to `isTransientNetworkError`. */
  isRetryable?: (error: unknown) => boolean;
  /** Optional callback triggered immediately before each retry delay sleep. */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

export const DEFAULT_RETRY_POLICY: Required<
  Omit<RetryPolicyOptions, 'isRetryable' | 'onRetry' | 'jitter'>
> & { jitter: boolean } = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 30_000,
  exponential: true,
  jitter: false,
};

const TRANSIENT_ERROR_CODES = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ESOCKETTIMEDOUT',
  'EHOSTUNREACH',
  'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
]);

const TRANSIENT_MESSAGE_PATTERNS = [
  'network timeout',
  'request timed out',
  'timed out',
  'timeout',
  'network error',
  'failed to fetch',
  'fetch failed',
  'connection reset',
  'connection refused',
  'socket hang up',
  '502 bad gateway',
  '503 service unavailable',
  '504 gateway timeout',
  '500 internal server error',
  'rate limit exceeded',
  'too many requests',
];

/**
 * Checks whether an error is transient and safe to retry automatically.
 *
 * Detects:
 * - Network timeouts and socket aborts
 * - POSIX/Node.js socket errors (ETIMEDOUT, ECONNRESET, etc.)
 * - HTTP status 5xx (500, 502, 503, 504)
 * - HTTP status 429 (Too Many Requests / Rate Limited)
 * - Standard fetch/axios/horizon network failure messages
 *
 * Non-transient errors (4xx client errors, invalid signatures, validation errors) return false.
 */
export function isTransientNetworkError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  if (typeof error === 'object') {
    const err = error as Record<string, unknown>;

    // 1. Check HTTP response status codes
    const status =
      typeof err['status'] === 'number'
        ? err['status']
        : typeof err['statusCode'] === 'number'
          ? err['statusCode']
          : typeof (err['response'] as Record<string, unknown> | undefined)?.['status'] === 'number'
            ? ((err['response'] as Record<string, unknown>)['status'] as number)
            : undefined;

    if (typeof status === 'number') {
      if ((status >= 500 && status < 600) || status === 429) {
        return true;
      }
      if (status >= 400 && status < 500) {
        return false;
      }
    }

    // 2. Check standard network error codes
    const code = typeof err['code'] === 'string' ? err['code'].toUpperCase() : undefined;
    if (code && TRANSIENT_ERROR_CODES.has(code)) {
      return true;
    }

    // 3. Check Abort/Timeout error names
    const name = typeof err['name'] === 'string' ? err['name'] : undefined;
    if (name === 'TimeoutError' || name === 'AbortError') {
      return true;
    }
  }

  // 4. Check error messages for common transient patterns
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return TRANSIENT_MESSAGE_PATTERNS.some((pattern) => msg.includes(pattern));
  }

  return false;
}

/**
 * Resolves a preset name or custom options into a normalized RetryPolicyOptions object.
 */
export function resolveRetryPolicy(
  policy?: RetryPolicyOptions | RetryPresetName | keyof typeof STELLAR_RETRY_PRESETS
): RetryPolicyOptions {
  if (!policy) {
    return { ...DEFAULT_RETRY_POLICY };
  }

  if (typeof policy === 'string') {
    if (policy in CORE_RETRY_PRESETS) {
      const preset = CORE_RETRY_PRESETS[policy as RetryPresetName];
      return {
        maxRetries: preset.maxRetries,
        baseDelayMs: preset.baseDelayMs,
        exponential: preset.exponential,
      };
    }

    if (policy in STELLAR_RETRY_PRESETS) {
      const stellarPreset =
        STELLAR_RETRY_PRESETS[policy as keyof typeof STELLAR_RETRY_PRESETS];
      return {
        maxRetries: stellarPreset.maxAttempts - 1,
        baseDelayMs: stellarPreset.baseDelayMs,
        exponential: stellarPreset.exponential ?? true,
      };
    }

    throw new InvalidRetryPresetError(policy);
  }

  return policy;
}

/**
 * Calculate delay for a retry attempt with exponential backoff and optional jitter.
 */
export function calculateRetryDelay(
  attempt: number,
  baseDelayMs: number,
  exponential: boolean,
  maxDelayMs: number = 30_000,
  jitter: boolean = false
): number {
  let delay = exponential
    ? Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs)
    : Math.min(baseDelayMs, maxDelayMs);

  if (jitter) {
    // Apply +/- 20% random jitter
    const jitterFactor = 0.8 + Math.random() * 0.4;
    delay = Math.round(delay * jitterFactor);
  }

  return Math.max(0, Math.min(delay, maxDelayMs));
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Executes an asynchronous network function with exponential backoff retries.
 *
 * @param fn - The async function to execute
 * @param policy - Optional retry policy or preset name
 * @returns The resolved value of `fn`
 * @throws The last encountered error when retries are exhausted or non-retryable
 *
 * @example
 * ```typescript
 * import { withNetworkRetry, RELIABLE } from '@ancore/core-sdk';
 *
 * const account = await withNetworkRetry(
 *   () => server.getAccount(accountId),
 *   RELIABLE
 * );
 * ```
 */
export async function withNetworkRetry<T>(
  fn: () => Promise<T>,
  policy?: RetryPolicyOptions | RetryPresetName
): Promise<T> {
  const resolved = resolveRetryPolicy(policy);
  const maxRetries = resolved.maxRetries ?? DEFAULT_RETRY_POLICY.maxRetries;
  const baseDelayMs = resolved.baseDelayMs ?? DEFAULT_RETRY_POLICY.baseDelayMs;
  const maxDelayMs = resolved.maxDelayMs ?? DEFAULT_RETRY_POLICY.maxDelayMs;
  const exponential = resolved.exponential ?? DEFAULT_RETRY_POLICY.exponential;
  const jitter = resolved.jitter ?? DEFAULT_RETRY_POLICY.jitter;
  const isRetryable = resolved.isRetryable ?? isTransientNetworkError;
  const onRetry = resolved.onRetry;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Exhausted all retry attempts
      if (attempt > maxRetries) {
        throw error;
      }

      // Check if this specific error is transient / retryable
      if (!isRetryable(error)) {
        throw error;
      }

      const delay = calculateRetryDelay(
        attempt,
        baseDelayMs,
        exponential,
        maxDelayMs,
        jitter
      );

      if (onRetry) {
        onRetry(attempt, error, delay);
      }

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Creates a reusable retry wrapper pre-configured with the given policy options.
 */
export function createRetryPolicyWrapper(
  defaultPolicy?: RetryPolicyOptions | RetryPresetName
) {
  return function executeWithPolicy<T>(
    fn: () => Promise<T>,
    overridePolicy?: RetryPolicyOptions | RetryPresetName
  ): Promise<T> {
    const effectivePolicy = overridePolicy ?? defaultPolicy;
    return withNetworkRetry(fn, effectivePolicy);
  };
}
