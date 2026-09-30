import {
  withRetry,
  calculateBackoffDelay,
  isTransientNetworkError,
  isTransientStatusCode,
  AncoreClient,
} from '../src/index';

describe('Retry Logic (tests/retry.spec.ts)', () => {
  it('identifies transient network status codes and errors', () => {
    expect(isTransientStatusCode(500)).toBe(true);
    expect(isTransientStatusCode(503)).toBe(true);
    expect(isTransientStatusCode(429)).toBe(true);
    expect(isTransientStatusCode(200)).toBe(false);
    expect(isTransientStatusCode(400)).toBe(false);

    expect(isTransientNetworkError({ code: 'TIMEOUT' })).toBe(true);
    expect(isTransientNetworkError({ code: 'ECONNRESET' })).toBe(true);
    expect(isTransientNetworkError({ status: 502 })).toBe(true);
  });

  it('calculates exponential backoff with jitter correctly', () => {
    // delay = min(baseDelay * (2 ^ attempt), maxDelay)
    const baseDelay = 100;
    const maxDelay = 10000;

    const delayAttempt0 = calculateBackoffDelay(0, baseDelay, maxDelay, false);
    const delayAttempt1 = calculateBackoffDelay(1, baseDelay, maxDelay, false);
    const delayAttempt2 = calculateBackoffDelay(2, baseDelay, maxDelay, false);

    expect(delayAttempt0).toBe(100);
    expect(delayAttempt1).toBe(200);
    expect(delayAttempt2).toBe(400);

    // Jitter verification (±10%)
    const jittered = calculateBackoffDelay(1, baseDelay, maxDelay, true);
    expect(jittered).toBeGreaterThanOrEqual(180);
    expect(jittered).toBeLessThanOrEqual(220);
  });

  it('retries transient failures and resolves upon success', async () => {
    let callCount = 0;
    const operation = async () => {
      callCount++;
      if (callCount < 3) {
        const error = new Error('Gateway Timeout');
        (error as any).status = 504;
        throw error;
      }
      return 'operation_recovered';
    };

    const result = await withRetry(operation, {
      maxRetries: 3,
      baseDelayMs: 5,
      jitter: false,
    });

    expect(result).toBe('operation_recovered');
    expect(callCount).toBe(3);
  });

  it('wraps client operations and uses client default retry configuration', async () => {
    const client = new AncoreClient({
      accountContractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM',
      retryOptions: {
        maxRetries: 2,
        baseDelayMs: 5,
        jitter: false,
      },
    });

    let attempts = 0;
    const result = await client.withRetry(async () => {
      attempts++;
      if (attempts === 1) {
        throw new Error('read ECONNRESET');
      }
      return { status: 'healthy' };
    });

    expect(result).toEqual({ status: 'healthy' });
    expect(attempts).toBe(2);
  });
});
