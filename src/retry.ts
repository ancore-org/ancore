export interface RetryPolicy {
  shouldRetry(attempt: number, error: any): boolean;
  getDelay(attempt: number): number;
}

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  /**
   * A function to determine if a given error should trigger a retry.
   * Defaults to retrying network errors and 5xx HTTP status codes.
   */
  retryCondition?: (error: any) => boolean;
}

export const defaultRetryOptions: Required<RetryOptions> = {
  maxAttempts: 5,
  initialDelayMs: 100, // 0.1 seconds
  maxDelayMs: 2000,    // 2 seconds
  factor: 2,
  retryCondition: (error: any) => {
    // Basic check for network errors (e.g., 'Failed to fetch') or 5xx status codes
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      return true; // Network error
    }
    if (error && error.response && error.response.status >= 500 && error.response.status < 600) {
      // Server error (5xx status code)
      // Exclude 501 Not Implemented, 505 HTTP Version Not Supported, etc., if they are not transient
      return true;
    }
    // Add more specific conditions if needed, e.g., specific error codes from Ancore API
    return false;
  },
};

export class ExponentialBackoffRetryPolicy implements RetryPolicy {
  private options: Required<RetryOptions>;

  constructor(options?: RetryOptions) {
    this.options = { ...defaultRetryOptions, ...options };
  }

  shouldRetry(attempt: number, error: any): boolean {
    return attempt < this.options.maxAttempts && this.options.retryCondition(error);
  }

  getDelay(attempt: number): number {
    const delay = Math.min(
      this.options.initialDelayMs * Math.pow(this.options.factor, attempt - 1),
      this.options.maxDelayMs
    );
    // Add some jitter to prevent thundering herd problem
    return delay * (0.9 + Math.random() * 0.2); // 90% to 110% of calculated delay
  }
}

export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy,
  attempt: number = 1
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (policy.shouldRetry(attempt, error)) {
      const delay = policy.getDelay(attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
      return executeWithRetry(fn, policy, attempt + 1);
    }
    throw error;
  }
}
