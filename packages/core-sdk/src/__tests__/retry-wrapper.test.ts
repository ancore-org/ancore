import { describe, expect, test, vi } from 'vitest';
import {
  wrapWithRetry,
  wrapObjectWithRetry,
  DEFAULT_CLIENT_RETRY,
  withRetry,
  LOW_LATENCY,
  RELIABLE,
  AGGRESSIVE,
} from '../retry-wrapper';

describe('retry-wrapper', () => {
  describe('withRetry re-export', () => {
    test('withRetry is a function', () => {
      expect(typeof withRetry).toBe('function');
    });
  });

  describe('wrapWithRetry', () => {
    test('wraps an async function with retry', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 2) throw new Error('transient');
        return 'success';
      };

      const wrapped = wrapWithRetry(fn, { maxRetries: 3, baseDelayMs: 10 });
      const result = await wrapped();
      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    test('uses preset name as option', async () => {
      const fn = vi.fn().mockResolvedValue('ok');
      const wrapped = wrapWithRetry(fn, 'LOW_LATENCY');
      const result = await wrapped();
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('uses DEFAULT_CLIENT_RETRY when no options', async () => {
      expect(DEFAULT_CLIENT_RETRY).toEqual(AGGRESSIVE);
    });
  });

  describe('wrapObjectWithRetry', () => {
    test('wraps async methods only', async () => {
      let attempts = 0;
      const obj = {
        async asyncMethod() {
          attempts++;
          if (attempts < 2) throw new Error('retry me');
          return 'done';
        },
        syncMethod() {
          return 'sync';
        },
      };

      const wrapped = wrapObjectWithRetry(obj, { maxRetries: 3, baseDelayMs: 10 });
      expect(wrapped.syncMethod()).toBe('sync');
      const result = await wrapped.asyncMethod();
      expect(result).toBe('done');
      expect(attempts).toBe(2);
    });

    test('preserves non-function properties', () => {
      const obj = {
        value: 42,
        async method() { return 'ok'; },
      };
      const wrapped = wrapObjectWithRetry(obj, { maxRetries: 1 });
      expect(wrapped.value).toBe(42);
    });
  });

  describe('presets re-exported', () => {
    test('LOW_LATENCY has correct config', () => {
      expect(LOW_LATENCY.maxRetries).toBe(2);
      expect(LOW_LATENCY.baseDelayMs).toBe(200);
    });

    test('RELIABLE has exponential backoff', () => {
      expect(RELIABLE.exponential).toBe(true);
      expect(RELIABLE.maxRetries).toBe(8);
    });

    test('AGGRESSIVE has 4 retries', () => {
      expect(AGGRESSIVE.maxRetries).toBe(4);
    });
  });
});
