/**
 * Tests for retry logic
 */

import { withRetry, calculateDelay } from '../retry';
import { RetryExhaustedError } from '../errors';

describe('retry', () => {
  describe('calculateDelay', () => {
    it('should calculate exponential backoff delays', () => {
      expect(calculateDelay(1, 1000, true)).toBe(1000); // 1s
      expect(calculateDelay(2, 1000, true)).toBe(2000); // 2s
      expect(calculateDelay(3, 1000, true)).toBe(4000); // 4s
      expect(calculateDelay(4, 1000, true)).toBe(8000); // 8s
    });

    it('should calculate linear delays when exponential is false', () => {
      expect(calculateDelay(1, 1000, false)).toBe(1000);
      expect(calculateDelay(2, 1000, false)).toBe(1000);
      expect(calculateDelay(3, 1000, false)).toBe(1000);
    });

    it('should use custom base delay', () => {
      expect(calculateDelay(1, 500, true)).toBe(500);
      expect(calculateDelay(2, 500, true)).toBe(1000);
      expect(calculateDelay(3, 500, true)).toBe(2000);
    });
  });

  describe('withRetry', () => {
    it('should execute function successfully on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await withRetry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Attempt 1 failed'))
        .mockRejectedValueOnce(new Error('Attempt 2 failed'))
        .mockResolvedValueOnce('success');

      const result = await withRetry(fn, {
        maxRetries: 3,
        baseDelayMs: 10,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw RetryExhaustedError after max retries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Always fails'));

      await expect(
        withRetry(fn, {
          maxRetries: 2,
          baseDelayMs: 10,
        })
      ).rejects.toThrow(RetryExhaustedError);

      expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('should include last error in RetryExhaustedError', async () => {
      const testError = new Error('Test error');
      const fn = jest.fn().mockRejectedValue(testError);

      try {
        await withRetry(fn, {
          maxRetries: 1,
          baseDelayMs: 10,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(RetryExhaustedError);
        expect((error as RetryExhaustedError).lastError).toBe(testError);
      }
    });

    it('should respect isRetryable predicate', async () => {
      const retryableError = new Error('Retryable');
      const nonRetryableError = new Error('Non-retryable');

      const fn = jest
        .fn()
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(nonRetryableError);

      await expect(
        withRetry(fn, {
          maxRetries: 3,
          baseDelayMs: 10,
          isRetryable: (error) => error.message === 'Retryable',
        })
      ).rejects.toThrow('Non-retryable');

      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should use exponential backoff by default', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('success');

      const startTime = Date.now();

      await withRetry(fn, {
        maxRetries: 2,
        baseDelayMs: 50,
        exponential: true,
      });

      const elapsed = Date.now() - startTime;

      // Should take at least 50ms (first retry) + 100ms (second retry) = 150ms
      // Allow some tolerance for execution time
      expect(elapsed).toBeGreaterThanOrEqual(140);
    });

    it('should use linear backoff when exponential is false', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('success');

      const startTime = Date.now();

      await withRetry(fn, {
        maxRetries: 2,
        baseDelayMs: 50,
        exponential: false,
      });

      const elapsed = Date.now() - startTime;

      // Should take at least 50ms + 50ms = 100ms
      expect(elapsed).toBeGreaterThanOrEqual(90);
    });

    it('should handle non-Error rejections', async () => {
      const fn = jest.fn().mockRejectedValueOnce('String error').mockResolvedValueOnce('success');

      const result = await withRetry(fn, {
        maxRetries: 1,
        baseDelayMs: 10,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should use default options when not provided', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await withRetry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle async functions that throw', async () => {
      const fn = jest.fn(async () => {
        throw new Error('Async error');
      });

      await expect(
        withRetry(fn, {
          maxRetries: 1,
          baseDelayMs: 10,
        })
      ).rejects.toThrow(RetryExhaustedError);

      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should preserve return type', async () => {
      interface TestData {
        id: string;
        value: number;
      }

      const testData: TestData = { id: 'test', value: 42 };
      const fn = jest.fn().mockResolvedValue(testData);

      const result = await withRetry(fn);

      expect(result).toEqual(testData);
      expect(result.id).toBe('test');
      expect(result.value).toBe(42);
    });
  });
});
