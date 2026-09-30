/**
 * Unit tests for Retry Policy Wrapper in @ancore/core-sdk
 */

import { AncoreClient } from '../ancore-client';
import { InvalidRetryPresetError } from '../errors';
import {
  calculateRetryDelay,
  createRetryPolicyWrapper,
  DEFAULT_RETRY_POLICY,
  isTransientNetworkError,
  resolveRetryPolicy,
  withNetworkRetry,
} from '../retry-policy';
import type { RetryPolicyOptions } from '../retry-policy';

describe('retry-policy', () => {
  describe('isTransientNetworkError', () => {
    it('returns false for null, undefined, or empty values', () => {
      expect(isTransientNetworkError(null)).toBe(false);
      expect(isTransientNetworkError(undefined)).toBe(false);
      expect(isTransientNetworkError('')).toBe(false);
      expect(isTransientNetworkError({})).toBe(false);
    });

    it('identifies HTTP 5xx server errors as transient', () => {
      expect(isTransientNetworkError({ status: 500 })).toBe(true);
      expect(isTransientNetworkError({ status: 502 })).toBe(true);
      expect(isTransientNetworkError({ statusCode: 503 })).toBe(true);
      expect(isTransientNetworkError({ response: { status: 504 } })).toBe(true);
    });

    it('identifies HTTP 429 Too Many Requests as transient', () => {
      expect(isTransientNetworkError({ status: 429 })).toBe(true);
      expect(isTransientNetworkError({ statusCode: 429 })).toBe(true);
      expect(isTransientNetworkError({ response: { status: 429 } })).toBe(true);
    });

    it('identifies HTTP 4xx client errors (except 429) as non-transient', () => {
      expect(isTransientNetworkError({ status: 400 })).toBe(false);
      expect(isTransientNetworkError({ status: 401 })).toBe(false);
      expect(isTransientNetworkError({ status: 403 })).toBe(false);
      expect(isTransientNetworkError({ status: 404 })).toBe(false);
      expect(isTransientNetworkError({ statusCode: 422 })).toBe(false);
    });

    it('identifies POSIX network socket error codes as transient', () => {
      expect(isTransientNetworkError({ code: 'ETIMEDOUT' })).toBe(true);
      expect(isTransientNetworkError({ code: 'ECONNRESET' })).toBe(true);
      expect(isTransientNetworkError({ code: 'ECONNREFUSED' })).toBe(true);
      expect(isTransientNetworkError({ code: 'ENOTFOUND' })).toBe(true);
      expect(isTransientNetworkError({ code: 'EAI_AGAIN' })).toBe(true);
      expect(isTransientNetworkError({ code: 'UND_ERR_CONNECT_TIMEOUT' })).toBe(true);
    });

    it('identifies TimeoutError and AbortError names as transient', () => {
      expect(isTransientNetworkError({ name: 'TimeoutError' })).toBe(true);
      expect(isTransientNetworkError({ name: 'AbortError' })).toBe(true);
    });

    it('identifies transient keywords in Error messages', () => {
      expect(isTransientNetworkError(new Error('Network timeout while calling Soroban RPC'))).toBe(true);
      expect(isTransientNetworkError(new Error('fetch failed'))).toBe(true);
      expect(isTransientNetworkError(new Error('Failed to fetch'))).toBe(true);
      expect(isTransientNetworkError(new Error('Connection reset by peer'))).toBe(true);
      expect(isTransientNetworkError(new Error('503 Service Unavailable'))).toBe(true);
      expect(isTransientNetworkError(new Error('Rate limit exceeded'))).toBe(true);
    });

    it('returns false for non-transient error messages', () => {
      expect(isTransientNetworkError(new Error('Invalid signature'))).toBe(false);
      expect(isTransientNetworkError(new Error('Account not found'))).toBe(false);
      expect(isTransientNetworkError(new Error('Validation failed'))).toBe(false);
    });
  });

  describe('resolveRetryPolicy', () => {
    it('returns default policy when no options are passed', () => {
      const policy = resolveRetryPolicy();
      expect(policy).toEqual(DEFAULT_RETRY_POLICY);
    });

    it('resolves core SDK preset strings', () => {
      const lowLatency = resolveRetryPolicy('LOW_LATENCY');
      expect(lowLatency.maxRetries).toBe(2);
      expect(lowLatency.baseDelayMs).toBe(200);
      expect(lowLatency.exponential).toBe(false);

      const reliable = resolveRetryPolicy('RELIABLE');
      expect(reliable.maxRetries).toBe(8);
      expect(reliable.baseDelayMs).toBe(3000);
      expect(reliable.exponential).toBe(true);

      const aggressive = resolveRetryPolicy('AGGRESSIVE');
      expect(aggressive.maxRetries).toBe(4);
      expect(aggressive.baseDelayMs).toBe(500);
      expect(aggressive.exponential).toBe(true);
    });

    it('resolves stellar package preset strings', () => {
      const wallet = resolveRetryPolicy('wallet');
      expect(wallet.maxRetries).toBeDefined();
      expect(wallet.baseDelayMs).toBeDefined();

      const indexer = resolveRetryPolicy('indexer');
      expect(indexer.maxRetries).toBeDefined();
    });

    it('throws InvalidRetryPresetError for unknown preset names', () => {
      expect(() => resolveRetryPolicy('INVALID_PRESET' as any)).toThrow(InvalidRetryPresetError);
    });

    it('returns custom options object as-is', () => {
      const custom: RetryPolicyOptions = {
        maxRetries: 5,
        baseDelayMs: 100,
        exponential: false,
      };
      expect(resolveRetryPolicy(custom)).toBe(custom);
    });
  });

  describe('calculateRetryDelay', () => {
    it('calculates exponential delay correctly', () => {
      // delay = baseDelay * 2^(attempt - 1)
      expect(calculateRetryDelay(1, 100, true, 5000)).toBe(100);
      expect(calculateRetryDelay(2, 100, true, 5000)).toBe(200);
      expect(calculateRetryDelay(3, 100, true, 5000)).toBe(400);
      expect(calculateRetryDelay(4, 100, true, 5000)).toBe(800);
    });

    it('calculates linear delay when exponential is false', () => {
      expect(calculateRetryDelay(1, 100, false, 5000)).toBe(100);
      expect(calculateRetryDelay(2, 100, false, 5000)).toBe(100);
      expect(calculateRetryDelay(3, 100, false, 5000)).toBe(100);
    });

    it('caps delay at maxDelayMs', () => {
      expect(calculateRetryDelay(10, 1000, true, 2000)).toBe(2000);
    });

    it('applies jitter within +/- 20% range', () => {
      for (let i = 0; i < 20; i++) {
        const delay = calculateRetryDelay(1, 1000, false, 5000, true);
        expect(delay).toBeGreaterThanOrEqual(800);
        expect(delay).toBeLessThanOrEqual(1200);
      }
    });
  });

  describe('withNetworkRetry', () => {
    it('resolves immediately when operation succeeds on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await withNetworkRetry(fn, { maxRetries: 3, baseDelayMs: 1 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries transient failures and returns result upon recovery', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce({ status: 503 })
        .mockResolvedValue('recovered');

      const onRetry = jest.fn();

      const result = await withNetworkRetry(fn, {
        maxRetries: 3,
        baseDelayMs: 1,
        exponential: false,
        onRetry,
      });

      expect(result).toBe('recovered');
      expect(fn).toHaveBeenCalledTimes(3);
      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error), expect.any(Number));
      expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.objectContaining({ status: 503 }), expect.any(Number));
    });

    it('does not retry non-transient errors (e.g. 400 Bad Request)', async () => {
      const clientError = { status: 400, message: 'Bad Request' };
      const fn = jest.fn().mockRejectedValue(clientError);
      const onRetry = jest.fn();

      await expect(
        withNetworkRetry(fn, {
          maxRetries: 3,
          baseDelayMs: 1,
          onRetry,
        })
      ).rejects.toEqual(clientError);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(onRetry).not.toHaveBeenCalled();
    });

    it('throws the last error when all retries are exhausted', async () => {
      const error = new Error('504 Gateway Timeout');
      const fn = jest.fn().mockRejectedValue(error);
      const onRetry = jest.fn();

      await expect(
        withNetworkRetry(fn, {
          maxRetries: 2,
          baseDelayMs: 1,
          exponential: false,
          onRetry,
        })
      ).rejects.toThrow('504 Gateway Timeout');

      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(onRetry).toHaveBeenCalledTimes(2);
    });

    it('supports custom isRetryable predicate override', async () => {
      const customError = new Error('Custom Business Error');
      const fn = jest
        .fn()
        .mockRejectedValueOnce(customError)
        .mockResolvedValue('recovered');

      const isRetryable = jest.fn().mockReturnValue(true);

      const result = await withNetworkRetry(fn, {
        maxRetries: 2,
        baseDelayMs: 1,
        isRetryable,
      });

      expect(result).toBe('recovered');
      expect(isRetryable).toHaveBeenCalledWith(customError);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('works with preset string names', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce({ code: 'ETIMEDOUT' })
        .mockResolvedValue('ok');

      const result = await withNetworkRetry(fn, 'LOW_LATENCY');
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('createRetryPolicyWrapper', () => {
    it('creates a reusable wrapper that applies the default policy', async () => {
      const wrapper = createRetryPolicyWrapper({
        maxRetries: 2,
        baseDelayMs: 1,
      });

      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('fetch failed'))
        .mockResolvedValue('wrapped_success');

      const result = await wrapper(fn);
      expect(result).toBe('wrapped_success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('allows overriding policy on specific calls', async () => {
      const wrapper = createRetryPolicyWrapper({
        maxRetries: 0,
        baseDelayMs: 1,
      });

      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('fetch failed'))
        .mockResolvedValue('override_success');

      const result = await wrapper(fn, { maxRetries: 2, baseDelayMs: 1 });
      expect(result).toBe('override_success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('AncoreClient retry integration', () => {
    it('initializes with optional retry policy', () => {
      const client = new AncoreClient({
        accountContractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM',
        retry: 'RELIABLE',
      });

      expect(client.getRetryPolicy()).toBe('RELIABLE');
    });

    it('executes client.withRetry using client default retry policy', async () => {
      const client = new AncoreClient({
        accountContractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM',
        retry: { maxRetries: 2, baseDelayMs: 1 },
      });

      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Connection reset'))
        .mockResolvedValue({ id: 'account_123' });

      const result = await client.withRetry(fn);
      expect(result).toEqual({ id: 'account_123' });
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('allows overriding retry policy in client.withRetry', async () => {
      const client = new AncoreClient({
        accountContractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM',
        retry: { maxRetries: 0, baseDelayMs: 1 },
      });

      const fn = jest
        .fn()
        .mockRejectedValueOnce({ status: 502 })
        .mockResolvedValue({ id: 'account_override' });

      const result = await client.withRetry(fn, { maxRetries: 2, baseDelayMs: 1 });
      expect(result).toEqual({ id: 'account_override' });
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
