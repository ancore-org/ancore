import {
  withRetry,
  calculateBackoffDelay,
  isTransientNetworkError,
  isTransientStatusCode,
  AncoreClient,
} from '../index';

describe('Retry Utilities (withRetry)', () => {
  describe('isTransientStatusCode', () => {
    it('should return true for 5xx server error codes', () => {
      expect(isTransientStatusCode(500)).toBe(true);
      expect(isTransientStatusCode(502)).toBe(true);
      expect(isTransientStatusCode(503)).toBe(true);
      expect(isTransientStatusCode(504)).toBe(true);
      expect(isTransientStatusCode(520)).toBe(true);
      expect(isTransientStatusCode(599)).toBe(true);
    });

    it('should return true for 429 rate limit and 408 request timeout', () => {
      expect(isTransientStatusCode(429)).toBe(true);
      expect(isTransientStatusCode(408)).toBe(true);
    });

    it('should return false for 2xx, 3xx, 4xx (except 429/408), and invalid values', () => {
      expect(isTransientStatusCode(200)).toBe(false);
      expect(isTransientStatusCode(201)).toBe(false);
      expect(isTransientStatusCode(301)).toBe(false);
      expect(isTransientStatusCode(400)).toBe(false);
      expect(isTransientStatusCode(401)).toBe(false);
      expect(isTransientStatusCode(403)).toBe(false);
      expect(isTransientStatusCode(404)).toBe(false);
      expect(isTransientStatusCode(undefined)).toBe(false);
      expect(isTransientStatusCode(null)).toBe(false);
      expect(isTransientStatusCode(NaN)).toBe(false);
      expect(isTransientStatusCode('500')).toBe(false);
    });
  });

  describe('isTransientNetworkError', () => {
    it('should identify errors with transient codes', () => {
      expect(isTransientNetworkError({ code: 'TIMEOUT' })).toBe(true);
      expect(isTransientNetworkError({ code: 'ETIMEDOUT' })).toBe(true);
      expect(isTransientNetworkError({ code: 'ESOCKETTIMEDOUT' })).toBe(true);
      expect(isTransientNetworkError({ code: 'ECONNRESET' })).toBe(true);
      expect(isTransientNetworkError({ code: 'ECONNREFUSED' })).toBe(true);
      expect(isTransientNetworkError({ code: 'ENOTFOUND' })).toBe(true);
      expect(isTransientNetworkError({ code: 'ENETUNREACH' })).toBe(true);
      expect(isTransientNetworkError({ code: 'EAI_AGAIN' })).toBe(true);
    });

    it('should identify errors with 5xx HTTP status codes', () => {
      expect(isTransientNetworkError({ status: 500 })).toBe(true);
      expect(isTransientNetworkError({ statusCode: 503 })).toBe(true);
      expect(isTransientNetworkError({ response: { status: 502 } })).toBe(true);
      expect(isTransientNetworkError({ response: { statusCode: 504 } })).toBe(true);
      expect(isTransientNetworkError({ httpStatus: 500 })).toBe(true);
    });

    it('should identify transient error messages and Error instances', () => {
      expect(isTransientNetworkError(new Error('connect ETIMEDOUT 127.0.0.1:8000'))).toBe(true);
      expect(isTransientNetworkError(new Error('read ECONNRESET'))).toBe(true);
      expect(isTransientNetworkError(new Error('Failed to fetch'))).toBe(true);
      expect(isTransientNetworkError(new Error('Network request failed'))).toBe(true);
      expect(isTransientNetworkError(new Error('503 Service Unavailable'))).toBe(true);
      expect(isTransientNetworkError(new Error('504 Gateway Timeout'))).toBe(true);
      expect(isTransientNetworkError(new Error('502 Bad Gateway'))).toBe(true);
      expect(isTransientNetworkError('socket hung up')).toBe(true);
    });

    it('should return false for permanent or client-side errors', () => {
      expect(isTransientNetworkError(null)).toBe(false);
      expect(isTransientNetworkError(undefined)).toBe(false);
      expect(isTransientNetworkError({ status: 400 })).toBe(false);
      expect(isTransientNetworkError({ statusCode: 401 })).toBe(false);
      expect(isTransientNetworkError({ status: 403 })).toBe(false);
      expect(isTransientNetworkError({ status: 404 })).toBe(false);
      expect(isTransientNetworkError(new Error('Invalid signature'))).toBe(false);
      expect(isTransientNetworkError(new Error('Account contract is already initialized'))).toBe(
        false
      );
    });
  });

  describe('calculateBackoffDelay', () => {
    it('calculates deterministic exponential backoff when jitter is disabled', () => {
      const base = 100;
      const max = 10000;

      // delay = min(baseDelay * 2^attempt, maxDelay)
      expect(calculateBackoffDelay(0, base, max, false)).toBe(100);
      expect(calculateBackoffDelay(1, base, max, false)).toBe(200);
      expect(calculateBackoffDelay(2, base, max, false)).toBe(400);
      expect(calculateBackoffDelay(3, base, max, false)).toBe(800);
      expect(calculateBackoffDelay(4, base, max, false)).toBe(1600);
    });

    it('clamps delay to maxDelayMs', () => {
      const base = 1000;
      const max = 3000;

      expect(calculateBackoffDelay(0, base, max, false)).toBe(1000);
      expect(calculateBackoffDelay(1, base, max, false)).toBe(2000);
      expect(calculateBackoffDelay(2, base, max, false)).toBe(3000);
      expect(calculateBackoffDelay(5, base, max, false)).toBe(3000);
    });

    it('applies ±10% jitter by default', () => {
      const base = 1000;
      const max = 10000;

      for (let i = 0; i < 50; i++) {
        const delay = calculateBackoffDelay(1, base, max, true); // attempt 1: base delay 2000
        // Expected range: [2000 * 0.9, 2000 * 1.1] -> [1800, 2200]
        expect(delay).toBeGreaterThanOrEqual(1800);
        expect(delay).toBeLessThanOrEqual(2200);
      }
    });

    it('supports custom jitter ratio', () => {
      const base = 1000;
      const max = 10000;
      const customJitter = 0.2; // ±20%

      for (let i = 0; i < 50; i++) {
        const delay = calculateBackoffDelay(0, base, max, customJitter); // attempt 0: base delay 1000
        expect(delay).toBeGreaterThanOrEqual(800);
        expect(delay).toBeLessThanOrEqual(1200);
      }
    });

    it('supports linear backoff when exponential is false', () => {
      const base = 250;
      const max = 1000;

      expect(calculateBackoffDelay(0, base, max, false, false)).toBe(250);
      expect(calculateBackoffDelay(1, base, max, false, false)).toBe(250);
      expect(calculateBackoffDelay(5, base, max, false, false)).toBe(250);
    });
  });

  describe('withRetry execution', () => {
    it('returns result immediately on first attempt if successful', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await withRetry(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on transient errors and succeeds on subsequent attempt', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('read ECONNRESET'))
        .mockRejectedValueOnce({ status: 503 })
        .mockResolvedValueOnce({ data: 'recovered' });

      const onRetry = jest.fn();

      const result = await withRetry(fn, {
        maxRetries: 3,
        baseDelayMs: 5,
        jitter: false,
        onRetry,
      });

      expect(result).toEqual({ data: 'recovered' });
      expect(fn).toHaveBeenCalledTimes(3);
      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error), 5);
      expect(onRetry).toHaveBeenNthCalledWith(2, 2, { status: 503 }, 10);
    });

    it('fails immediately without retry on non-transient errors (e.g. 400 Bad Request)', async () => {
      const fn = jest.fn().mockRejectedValue({ status: 400, message: 'Bad Request' });
      const onRetry = jest.fn();

      await expect(withRetry(fn, { baseDelayMs: 5, onRetry })).rejects.toEqual({
        status: 400,
        message: 'Bad Request',
      });
      expect(fn).toHaveBeenCalledTimes(1);
      expect(onRetry).not.toHaveBeenCalled();
    });

    it('throws error after exhausting all retries (default: 3 retries / 4 attempts)', async () => {
      const transientErr = new Error('connect ETIMEDOUT');
      const fn = jest.fn().mockRejectedValue(transientErr);
      const onRetry = jest.fn();

      await expect(
        withRetry(fn, {
          maxRetries: 3,
          baseDelayMs: 5,
          jitter: false,
          onRetry,
        })
      ).rejects.toThrow('connect ETIMEDOUT');

      expect(fn).toHaveBeenCalledTimes(4); // initial + 3 retries
      expect(onRetry).toHaveBeenCalledTimes(3);
    });

    it('respects custom maxRetries parameter', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('500 Internal Server Error'));

      await expect(
        withRetry(fn, {
          maxRetries: 1,
          baseDelayMs: 5,
          jitter: false,
        })
      ).rejects.toThrow('500 Internal Server Error');

      expect(fn).toHaveBeenCalledTimes(2); // initial + 1 retry
    });

    it('supports custom isRetryable predicate', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('CUSTOM_RETRY_CODE'))
        .mockResolvedValueOnce('success');

      const isRetryable = jest.fn((err: unknown) => {
        return err instanceof Error && err.message === 'CUSTOM_RETRY_CODE';
      });

      const result = await withRetry(fn, {
        baseDelayMs: 5,
        jitter: false,
        isRetryable,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
      expect(isRetryable).toHaveBeenCalled();
    });

    it('handles exceptions in onRetry callback gracefully', async () => {
      const fn = jest.fn().mockRejectedValueOnce(new Error('TIMEOUT')).mockResolvedValueOnce('ok');

      const failingOnRetry = jest.fn(() => {
        throw new Error('Logger exploded');
      });

      const result = await withRetry(fn, {
        baseDelayMs: 5,
        jitter: false,
        onRetry: failingOnRetry,
      });

      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('AncoreClient retry integration', () => {
    it('allows executing custom network calls via client.withRetry', async () => {
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
        if (attempts < 2) {
          throw new Error('ECONNRESET');
        }
        return 'client-success';
      });

      expect(result).toBe('client-success');
      expect(attempts).toBe(2);
    });
  });
});
