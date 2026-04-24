/**
 * Tests for retry logic
 */

import { withRetry, calculateDelay } from '../retry';
import { RetryExhaustedError, NetworkError, AccountNotFoundError, TransactionError } from '../errors';

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

  // ─────────────────────────────────────────────────────────────────────────
  // Issue #275 — Stellar client resilience and retry policy validation
  // ─────────────────────────────────────────────────────────────────────────

  describe('resilience and error classification', () => {
    describe('transient vs permanent error classification', () => {
      it('should retry on transient network errors', async () => {
        const transientError = new NetworkError('Connection timeout', { statusCode: 504 });
        const fn = jest
          .fn()
          .mockRejectedValueOnce(transientError)
          .mockRejectedValueOnce(transientError)
          .mockResolvedValueOnce('success');

        const result = await withRetry(fn, {
          maxRetries: 3,
          baseDelayMs: 10,
          isRetryable: (error) => error instanceof NetworkError,
        });

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(3);
      });

      it('should not retry on permanent AccountNotFoundError', async () => {
        const permanentError = new AccountNotFoundError('GABC123...');
        const fn = jest.fn().mockRejectedValue(permanentError);

        await expect(
          withRetry(fn, {
            maxRetries: 3,
            baseDelayMs: 10,
            isRetryable: (error) => !(error instanceof AccountNotFoundError),
          })
        ).rejects.toThrow(AccountNotFoundError);

        expect(fn).toHaveBeenCalledTimes(1); // Should not retry
      });

      it('should not retry on permanent TransactionError with bad result', async () => {
        const permanentError = new TransactionError('Transaction failed', { resultCode: 'tx_bad_seq' });
        const fn = jest.fn().mockRejectedValue(permanentError);

        await expect(
          withRetry(fn, {
            maxRetries: 3,
            baseDelayMs: 10,
            isRetryable: (error) => !(error instanceof TransactionError),
          })
        ).rejects.toThrow(TransactionError);

        expect(fn).toHaveBeenCalledTimes(1); // Should not retry
      });

      it('should retry on HTTP 5xx server errors', async () => {
        const serverError = new NetworkError('Internal server error', { statusCode: 500 });
        const fn = jest
          .fn()
          .mockRejectedValueOnce(serverError)
          .mockResolvedValueOnce('success');

        const result = await withRetry(fn, {
          maxRetries: 2,
          baseDelayMs: 10,
          isRetryable: (error) => {
            if (error instanceof NetworkError) {
              return error.statusCode ? error.statusCode >= 500 : true;
            }
            return false;
          },
        });

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
      });

      it('should not retry on HTTP 4xx client errors', async () => {
        const clientError = new NetworkError('Bad request', { statusCode: 400 });
        const fn = jest.fn().mockRejectedValue(clientError);

        await expect(
          withRetry(fn, {
            maxRetries: 3,
            baseDelayMs: 10,
            isRetryable: (error) => {
              if (error instanceof NetworkError) {
                return error.statusCode ? error.statusCode >= 500 : true;
              }
              return false;
            },
          })
        ).rejects.toThrow(NetworkError);

        expect(fn).toHaveBeenCalledTimes(1); // Should not retry
      });

      it('should retry on rate limiting errors (429)', async () => {
        const rateLimitError = new NetworkError('Rate limit exceeded', { statusCode: 429 });
        const fn = jest
          .fn()
          .mockRejectedValueOnce(rateLimitError)
          .mockResolvedValueOnce('success');

        const result = await withRetry(fn, {
          maxRetries: 2,
          baseDelayMs: 10,
          isRetryable: (error) => {
            if (error instanceof NetworkError) {
              const status = error.statusCode;
              return status === 429 || (status && status >= 500);
            }
            return false;
          },
        });

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
      });
    });

    describe('deterministic retry backoff behavior', () => {
      it('should have predictable exponential backoff timing', async () => {
        const delays: number[] = [];
        const fn = jest
          .fn()
          .mockRejectedValue(new Error('Fail'))
          .mockRejectedValue(new Error('Fail'))
          .mockRejectedValue(new Error('Fail'))
          .mockResolvedValue('success');

        // Mock setTimeout to capture delays
        const originalSetTimeout = global.setTimeout;
        const mockSetTimeout = jest.fn((callback, delay) => {
          delays.push(delay);
          return originalSetTimeout(callback, 0); // Execute immediately for test
        });
        global.setTimeout = mockSetTimeout;

        try {
          await withRetry(fn, {
            maxRetries: 3,
            baseDelayMs: 100,
            exponential: true,
          });
        } catch {
          // Expected to fail after all retries
        }

        global.setTimeout = originalSetTimeout;

        // Should have attempted 4 times (1 initial + 3 retries)
        expect(fn).toHaveBeenCalledTimes(4);
        // Should have 3 retry delays
        expect(delays).toEqual([100, 200, 400]); // 100ms, 200ms, 400ms
      });

      it('should respect maximum retry limit', async () => {
        const fn = jest.fn().mockRejectedValue(new Error('Always fails'));

        try {
          await withRetry(fn, {
            maxRetries: 2,
            baseDelayMs: 10,
          });
        } catch (error) {
          expect(error).toBeInstanceOf(RetryExhaustedError);
          expect((error as RetryExhaustedError).attempts).toBe(3); // 1 initial + 2 retries
        }

        expect(fn).toHaveBeenCalledTimes(3);
      });

      it('should handle terminal failure boundaries correctly', async () => {
        const fn = jest.fn().mockRejectedValue(new Error('Terminal error'));

        try {
          await withRetry(fn, {
            maxRetries: 5,
            baseDelayMs: 10,
          });
        } catch (error) {
          expect(error).toBeInstanceOf(RetryExhaustedError);
          expect((error as RetryExhaustedError).attempts).toBe(6); // 1 initial + 5 retries
          expect((error as RetryExhaustedError).lastError).toBeInstanceOf(Error);
        }

        expect(fn).toHaveBeenCalledTimes(6);
      });

      it('should have consistent retry intervals under load', async () => {
        const concurrentCalls = 5;
        const promises = Array.from({ length: concurrentCalls }, () => {
          const fn = jest
            .fn()
            .mockRejectedValueOnce(new Error('Fail 1'))
            .mockRejectedValueOnce(new Error('Fail 2'))
            .mockResolvedValueOnce('success');

          return withRetry(fn, {
            maxRetries: 2,
            baseDelayMs: 50,
            exponential: true,
          });
        });

        const results = await Promise.all(promises);
        expect(results).toEqual(Array(concurrentCalls).fill('success'));
      });
    });

    describe('default retry policy behavior', () => {
      it('should use default retry policy when options not provided', async () => {
        const fn = jest
          .fn()
          .mockRejectedValueOnce(new Error('Fail 1'))
          .mockRejectedValueOnce(new Error('Fail 2'))
          .mockRejectedValueOnce(new Error('Fail 3'))
          .mockResolvedValueOnce('success');

        const result = await withRetry(fn);

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(4); // Should use default maxRetries: 3
      });

      it('should allow override of default retry parameters', async () => {
        const fn = jest
          .fn()
          .mockRejectedValueOnce(new Error('Fail 1'))
          .mockResolvedValueOnce('success');

        const result = await withRetry(fn, {
          maxRetries: 5,
          baseDelayMs: 200,
          exponential: false,
        });

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
      });

      it('should document retry policy override points', async () => {
        // Test that all retry policy parameters can be overridden
        const customOptions = {
          maxRetries: 10,
          baseDelayMs: 500,
          exponential: false,
          isRetryable: (error: Error) => error.message.includes('retryable'),
        };

        const retryableError = new Error('retryable error');
        const nonRetryableError = new Error('non-retryable error');

        const fn = jest
          .fn()
          .mockRejectedValueOnce(retryableError)
          .mockRejectedValueOnce(nonRetryableError);

        await expect(withRetry(fn, customOptions)).rejects.toThrow('non-retryable error');
        expect(fn).toHaveBeenCalledTimes(2); // Should stop at non-retryable error
      });
    });

    describe('network failure scenario simulation', () => {
      it('should handle intermittent network failures', async () => {
        const networkErrors = [
          new NetworkError('Connection timeout'),
          new NetworkError('DNS resolution failed'),
          new NetworkError('Socket hang up'),
        ];

        const fn = jest
          .fn()
          .mockRejectedValueOnce(networkErrors[0])
          .mockRejectedValueOnce(networkErrors[1])
          .mockRejectedValueOnce(networkErrors[2])
          .mockResolvedValueOnce('recovered');

        const result = await withRetry(fn, {
          maxRetries: 5,
          baseDelayMs: 10,
          isRetryable: (error) => error instanceof NetworkError,
        });

        expect(result).toBe('recovered');
        expect(fn).toHaveBeenCalledTimes(4);
      });

      it('should handle mixed error types correctly', async () => {
        const transientError = new NetworkError('Server error', { statusCode: 503 });
        const permanentError = new AccountNotFoundError('GABC123...');

        const fn = jest
          .fn()
          .mockRejectedValueOnce(transientError)
          .mockRejectedValueOnce(permanentError);

        await expect(
          withRetry(fn, {
            maxRetries: 3,
            baseDelayMs: 10,
            isRetryable: (error) => !(error instanceof AccountNotFoundError),
          })
        ).rejects.toThrow(AccountNotFoundError);

        expect(fn).toHaveBeenCalledTimes(2); // Should retry transient error, then fail on permanent
      });

      it('should maintain error context through retry chain', async () => {
        const originalError = new NetworkError('Original network failure', {
          cause: new Error('Underlying socket error'),
          statusCode: 502,
        });

        const fn = jest.fn().mockRejectedValue(originalError);

        try {
          await withRetry(fn, {
            maxRetries: 2,
            baseDelayMs: 10,
          });
        } catch (error) {
          expect(error).toBeInstanceOf(RetryExhaustedError);
          const exhaustedError = error as RetryExhaustedError;
          expect(exhaustedError.lastError).toBe(originalError);
          expect(exhaustedError.lastError).toBeInstanceOf(NetworkError);
          expect((exhaustedError.lastError as NetworkError).statusCode).toBe(502);
        }
      });
    });
  });
});
