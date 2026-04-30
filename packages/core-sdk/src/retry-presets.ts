/**
 * Retry policy presets for common network operation scenarios.
 *
 * These presets provide standardized retry configurations to reduce
 * ad-hoc retry tuning across applications.
 *
 * @module retry-presets
 */

import type { RetryOptions } from '@ancore/stellar';

/**
 * Low-latency preset for time-sensitive operations.
 *
 * Optimized for quick failures with minimal waiting:
 * - 2 retry attempts to fail fast
 * - 200ms base delay for rapid feedback
 * - Linear backoff for predictable timing
 *
 * Use when:
 * - User-facing operations requiring quick response
 * - Real-time or interactive applications
 * - Operations where fast failure is preferred over retries
 *
 * @example
 * ```typescript
 * import { LOW_LATENCY, withRetry } from '@ancore/core-sdk';
 *
 * const result = await withRetry(
 *   () => fetchQuickStatus(),
 *   LOW_LATENCY
 * );
 * ```
 */
export const LOW_LATENCY: RetryOptions = {
  maxRetries: 2,
  baseDelayMs: 200,
  exponential: false,
};

/**
 * Reliable preset for critical operations.
 *
 * Maximizes success rate with extensive retry logic:
 * - 8 retry attempts to handle extended outages
 * - 3000ms base delay to wait out temporary issues
 * - Exponential backoff (3s, 6s, 12s, 24s, ...)
 *
 * Use when:
 * - Critical transactions that must succeed
 * - Operations during known network instability
 * - Background jobs where time is less critical
 *
 * @example
 * ```typescript
 * import { RELIABLE, withRetry } from '@ancore/core-sdk';
 *
 * const result = await withRetry(
 *   () => submitCriticalTransaction(tx),
 *   RELIABLE
 * );
 * ```
 */
export const RELIABLE: RetryOptions = {
  maxRetries: 8,
  baseDelayMs: 3000,
  exponential: true,
};

/**
 * Aggressive preset for high-throughput scenarios.
 *
 * Balanced for throughput with moderate resilience:
 * - 4 retry attempts for reasonable fault tolerance
 * - 500ms base delay to keep operations moving
 * - Exponential backoff (500ms, 1s, 2s, 4s)
 *
 * Use when:
 * - Bulk operations or batch processing
 * - High-volume API calls
 * - Scenarios where some failures are acceptable
 *
 * @example
 * ```typescript
 * import { AGGRESSIVE, withRetry } from '@ancore/core-sdk';
 *
 * const results = await Promise.all(
 *   items.map(item =>
 *     withRetry(() => processItem(item), AGGRESSIVE)
 *   )
 * );
 * ```
 */
export const AGGRESSIVE: RetryOptions = {
  maxRetries: 4,
  baseDelayMs: 500,
  exponential: true,
};

/**
 * All available retry presets for enumeration or dynamic selection.
 */
export const RETRY_PRESETS = {
  LOW_LATENCY,
  RELIABLE,
  AGGRESSIVE,
} as const;

/**
 * Type representing the name of a retry preset.
 */
export type RetryPresetName = keyof typeof RETRY_PRESETS;

/**
 * Get a retry preset by name.
 *
 * @param name - The name of the preset to retrieve
 * @returns The retry options for the specified preset
 * @throws Error if the preset name is not recognized
 *
 * @example
 * ```typescript
 * import { getRetryPreset } from '@ancore/core-sdk';
 *
 * const preset = getRetryPreset('RELIABLE');
 * // Use preset with withRetry or StellarClient
 * ```
 */
export function getRetryPreset(name: RetryPresetName): RetryOptions {
  const preset = RETRY_PRESETS[name];
  if (!preset) {
    throw new Error(`Unknown retry preset: ${name}`);
  }
  return { ...preset }; // Return a copy to prevent mutation
}
