/**
 * @ancore/core-sdk - Retry Utilities
 *
 * Built-in exponential backoff retry wrapper for network and RPC calls.
 * Provides configurable retry logic, jitter, and transient failure detection.
 */

export interface RetryOptions {
  /**
   * Maximum number of retry attempts after the initial failure.
   * @default 3
   */
  maxRetries?: number;

  /**
   * Base delay in milliseconds for backoff calculation.
   * @default 100
   */
  baseDelayMs?: number;

  /**
   * Maximum backoff delay cap in milliseconds.
   * @default 10000 (10s)
   */
  maxDelayMs?: number;

  /**
   * Whether to use exponential backoff (`delay = baseDelay * 2^attempt`).
   * If false, uses fixed `baseDelayMs`.
   * @default true
   */
  exponential?: boolean;

  /**
   * Jitter configuration to avoid thundering herd.
   * - `true`: applies ±10% random jitter
   * - `number`: custom jitter factor (e.g., 0.1 for ±10%)
   * - `false`: no jitter
   * @default true
   */
  jitter?: boolean | number;

  /**
   * Custom predicate to determine whether an error should trigger a retry.
   * If not provided, defaults to {@link isTransientNetworkError}.
   */
  isRetryable?: (error: unknown) => boolean;

  /**
   * Optional callback invoked before each retry attempt with attempt number, error, and sleep delay.
   */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'isRetryable' | 'onRetry'>> = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 10_000,
  exponential: true,
  jitter: true,
};

const TRANSIENT_ERROR_CODES = new Set([
  'TIMEOUT',
  'ETIMEDOUT',
  'ESOCKETTIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ENETUNREACH',
  'EAI_AGAIN',
  'EPIPE',
  'NETWORK_ERROR',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
]);

const TRANSIENT_MESSAGE_PATTERNS = [
  /timeout/i,
  /timed\s*out/i,
  /econnreset/i,
  /econnrefused/i,
  /enotfound/i,
  /enetunreach/i,
  /eai_again/i,
  /failed to fetch/i,
  /network\s*(request\s*)?failed/i,
  /socket hung up/i,
  /net::ERR_/i,
  /service unavailable/i,
  /gateway timeout/i,
  /bad gateway/i,
  /\b50[0234]\b/,
];

/**
 * Checks if an HTTP status code represents a transient 5xx server error or 429 rate limit.
 */
export function isTransientStatusCode(status: unknown): boolean {
  if (typeof status !== 'number' || isNaN(status)) {
    return false;
  }
  return (status >= 500 && status < 600) || status === 429 || status === 408;
}

/**
 * Extracts HTTP status code from error object or nested response.
 */
function extractStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = error as {
    status?: unknown;
    statusCode?: unknown;
    httpStatus?: unknown;
    response?: { status?: unknown; statusCode?: unknown };
  };

  if (typeof candidate.status === 'number') return candidate.status;
  if (typeof candidate.statusCode === 'number') return candidate.statusCode;
  if (typeof candidate.httpStatus === 'number') return candidate.httpStatus;
  if (typeof candidate.response?.status === 'number') return candidate.response.status;
  if (typeof candidate.response?.statusCode === 'number') return candidate.response.statusCode;

  return undefined;
}

/**
 * Determines whether an error is a transient network or server error eligible for automatic retry.
 *
 * Checks for:
 * - Network timeouts (TIMEOUT, ETIMEDOUT, ESOCKETTIMEDOUT, AbortError, timeout messages)
 * - Connection issues (ECONNRESET, ECONNREFUSED, ENOTFOUND, ENETUNREACH, EAI_AGAIN)
 * - 5xx Server Error status codes (500, 502, 503, 504, 520, etc.) and 429
 * - Standard fetch / network transport errors
 */
export function isTransientNetworkError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  // 1. Check HTTP status codes
  const statusCode = extractStatusCode(error);
  if (statusCode !== undefined && isTransientStatusCode(statusCode)) {
    return true;
  }

  // 2. Check error codes and names
  if (typeof error === 'object') {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && TRANSIENT_ERROR_CODES.has(code.toUpperCase())) {
      return true;
    }

    const name = (error as { name?: unknown }).name;
    if (typeof name === 'string') {
      if (name === 'TimeoutError' || name === 'AbortError' || name === 'FetchError') {
        return true;
      }
    }
  }

  // 3. Check error string representation and message
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === 'string'
        ? error
        : String(error);

  return TRANSIENT_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Calculates backoff delay for a retry attempt with exponential backoff and jitter.
 *
 * Formula: `delay = min(baseDelay * (2 ^ attempt), maxDelay)`
 * Jitter: ±10% (or custom ratio) applied to the base calculated delay.
 *
 * @param attempt 0-indexed attempt count (0 for 1st retry, 1 for 2nd retry, etc.)
 * @param baseDelayMs Base delay in milliseconds (default: 100)
 * @param maxDelayMs Maximum delay ceiling in milliseconds (default: 10000)
 * @param jitter Whether to add ±10% jitter (or specific factor) (default: true)
 * @param exponential Whether to scale exponentially (default: true)
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number = DEFAULT_RETRY_OPTIONS.baseDelayMs,
  maxDelayMs: number = DEFAULT_RETRY_OPTIONS.maxDelayMs,
  jitter: boolean | number = DEFAULT_RETRY_OPTIONS.jitter,
  exponential: boolean = DEFAULT_RETRY_OPTIONS.exponential
): number {
  const safeAttempt = Math.max(0, attempt);
  let delay = exponential
    ? Math.min(baseDelayMs * Math.pow(2, safeAttempt), maxDelayMs)
    : Math.min(baseDelayMs, maxDelayMs);

  if (jitter) {
    const jitterFactor = typeof jitter === 'number' ? Math.abs(jitter) : 0.1; // ±10%
    const randomFactor = (Math.random() * 2 - 1) * jitterFactor; // range: [-jitterFactor, +jitterFactor]
    delay = delay * (1 + randomFactor);
  }

  return Math.max(0, Math.min(Math.round(delay), maxDelayMs));
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => globalThis.setTimeout(resolve, ms));

/**
 * Executes an asynchronous function with built-in exponential backoff, jitter, and transient failure retries.
 *
 * @param fn Asynchronous function or operation to execute
 * @param options Retry options controlling attempts, delays, jitter, and error filters
 * @returns Result of the operation once successful
 * @throws The last encountered error after all retries are exhausted, or immediately on non-retryable errors
 *
 * @example
 * ```typescript
 * import { withRetry } from '@ancore/core-sdk';
 *
 * const result = await withRetry(
 *   async () => client.fetchAccountData(publicKey),
 *   { maxRetries: 3, baseDelayMs: 100, maxDelayMs: 10000 }
 * );
 * ```
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_RETRY_OPTIONS.maxRetries;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_RETRY_OPTIONS.baseDelayMs;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_RETRY_OPTIONS.maxDelayMs;
  const exponential = options.exponential ?? DEFAULT_RETRY_OPTIONS.exponential;
  const jitter = options.jitter ?? DEFAULT_RETRY_OPTIONS.jitter;
  const isRetryable = options.isRetryable ?? isTransientNetworkError;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Exhausted all retries -> break and throw
      if (attempt >= maxRetries) {
        break;
      }

      // Check if error qualifies for retry
      if (!isRetryable(error)) {
        throw error;
      }

      // Compute backoff delay
      const delayMs = calculateBackoffDelay(attempt, baseDelayMs, maxDelayMs, jitter, exponential);

      if (options.onRetry) {
        try {
          options.onRetry(attempt + 1, error, delayMs);
        } catch {
          // Callback errors should not abort the retry loop
        }
      }

      await sleep(delayMs);
    }
  }

  throw lastError;
}
