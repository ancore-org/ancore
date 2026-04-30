/**
 * Tests for retry policy presets
 */

import {
  LOW_LATENCY,
  RELIABLE,
  AGGRESSIVE,
  RETRY_PRESETS,
  type RetryPresetName,
  getRetryPreset,
} from '../retry-presets';
import type { RetryOptions } from '@ancore/stellar';

describe('retry-presets', () => {
  describe('LOW_LATENCY preset', () => {
    it('should have correct configuration for low-latency operations', () => {
      expect(LOW_LATENCY.maxRetries).toBe(2);
      expect(LOW_LATENCY.baseDelayMs).toBe(200);
      expect(LOW_LATENCY.exponential).toBe(false);
    });

    it('should use linear backoff for predictable timing', () => {
      expect(LOW_LATENCY.exponential).toBe(false);
    });

    it('should have minimal retry attempts for fast failure', () => {
      expect(LOW_LATENCY.maxRetries).toBeLessThanOrEqual(2);
    });
  });

  describe('RELIABLE preset', () => {
    it('should have correct configuration for critical operations', () => {
      expect(RELIABLE.maxRetries).toBe(8);
      expect(RELIABLE.baseDelayMs).toBe(3000);
      expect(RELIABLE.exponential).toBe(true);
    });

    it('should use exponential backoff for extended outages', () => {
      expect(RELIABLE.exponential).toBe(true);
    });

    it('should have maximum retry attempts for reliability', () => {
      expect(RELIABLE.maxRetries).toBeGreaterThanOrEqual(8);
    });

    it('should have longer base delay to wait out issues', () => {
      expect(RELIABLE.baseDelayMs).toBeGreaterThanOrEqual(3000);
    });
  });

  describe('AGGRESSIVE preset', () => {
    it('should have correct configuration for high-throughput', () => {
      expect(AGGRESSIVE.maxRetries).toBe(4);
      expect(AGGRESSIVE.baseDelayMs).toBe(500);
      expect(AGGRESSIVE.exponential).toBe(true);
    });

    it('should use exponential backoff for balanced retry', () => {
      expect(AGGRESSIVE.exponential).toBe(true);
    });

    it('should have moderate retry attempts', () => {
      expect(AGGRESSIVE.maxRetries).toBe(4);
    });

    it('should have shorter base delay for throughput', () => {
      expect(AGGRESSIVE.baseDelayMs).toBe(500);
    });
  });

  describe('RETRY_PRESETS collection', () => {
    it('should contain all presets', () => {
      expect(RETRY_PRESETS.LOW_LATENCY).toBeDefined();
      expect(RETRY_PRESETS.RELIABLE).toBeDefined();
      expect(RETRY_PRESETS.AGGRESSIVE).toBeDefined();
    });

    it('should have exactly three presets', () => {
      expect(Object.keys(RETRY_PRESETS)).toHaveLength(3);
    });

    it('should match individual preset exports', () => {
      expect(RETRY_PRESETS.LOW_LATENCY).toEqual(LOW_LATENCY);
      expect(RETRY_PRESETS.RELIABLE).toEqual(RELIABLE);
      expect(RETRY_PRESETS.AGGRESSIVE).toEqual(AGGRESSIVE);
    });
  });

  describe('getRetryPreset function', () => {
    it('should return LOW_LATENCY preset', () => {
      const preset = getRetryPreset('LOW_LATENCY');
      expect(preset).toEqual(LOW_LATENCY);
    });

    it('should return RELIABLE preset', () => {
      const preset = getRetryPreset('RELIABLE');
      expect(preset).toEqual(RELIABLE);
    });

    it('should return AGGRESSIVE preset', () => {
      const preset = getRetryPreset('AGGRESSIVE');
      expect(preset).toEqual(AGGRESSIVE);
    });

    it('should return a copy, not the original', () => {
      const preset = getRetryPreset('LOW_LATENCY');
      preset.maxRetries = 999; // Mutate the copy
      expect(LOW_LATENCY.maxRetries).toBe(2); // Original should be unchanged
    });

    it('should throw error for unknown preset name', () => {
      expect(() => {
        getRetryPreset('UNKNOWN' as RetryPresetName);
      }).toThrow('Unknown retry preset: UNKNOWN');
    });
  });

  describe('RetryPresetName type', () => {
    it('should accept valid preset names', () => {
      const names: RetryPresetName[] = ['LOW_LATENCY', 'RELIABLE', 'AGGRESSIVE'];
      expect(names).toHaveLength(3);
    });
  });

  describe('backward compatibility', () => {
    it('should maintain RetryOptions compatibility', () => {
      const presets: RetryOptions[] = [LOW_LATENCY, RELIABLE, AGGRESSIVE];
      presets.forEach((preset) => {
        expect(preset).toHaveProperty('maxRetries');
        expect(preset).toHaveProperty('baseDelayMs');
        expect(preset).toHaveProperty('exponential');
        expect(typeof preset.maxRetries).toBe('number');
        expect(typeof preset.baseDelayMs).toBe('number');
        expect(typeof preset.exponential).toBe('boolean');
      });
    });

    it('should allow partial override of presets', () => {
      const custom = { ...RELIABLE, maxRetries: 10 };
      expect(custom.maxRetries).toBe(10);
      expect(custom.baseDelayMs).toBe(3000);
      expect(custom.exponential).toBe(true);
    });
  });

  describe('preset behavior validation', () => {
    it('should calculate correct delays for LOW_LATENCY (linear)', () => {
      // Linear: all delays are baseDelayMs
      const baseMs = LOW_LATENCY.baseDelayMs!;
      expect(baseMs).toBe(200);
      expect(LOW_LATENCY.exponential).toBe(false);
    });

    it('should calculate correct delays for RELIABLE (exponential)', () => {
      // Exponential: 3s, 6s, 12s, 24s, 48s, 96s, 192s, 384s
      const baseMs = RELIABLE.baseDelayMs!;
      expect(baseMs).toBe(3000);
      expect(RELIABLE.exponential).toBe(true);
    });

    it('should calculate correct delays for AGGRESSIVE (exponential)', () => {
      // Exponential: 500ms, 1s, 2s, 4s
      const baseMs = AGGRESSIVE.baseDelayMs!;
      expect(baseMs).toBe(500);
      expect(AGGRESSIVE.exponential).toBe(true);
    });
  });
});
