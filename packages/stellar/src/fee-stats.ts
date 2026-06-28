/**
 * Fee statistics fetcher for the Stellar network.
 *
 * Fetches recent fee stats from the Horizon `/fee_stats` endpoint and
 * normalizes them into a consistent structure. Falls back to a safe default
 * when the endpoint is unavailable.
 *
 * Retry behavior: uses the caller-supplied RetryOptions (default: 3 retries,
 * 1 s base delay, exponential backoff). All network failures are retried;
 * non-2xx responses that are not 429 / 5xx are treated as permanent and are
 * NOT retried. After exhausting retries the fallback value is returned.
 */

import { withRetry, type RetryOptions } from './retry';
import { NetworkError } from './errors';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FeeStats {
  /** Minimum accepted fee per operation in stroops. */
  minFee: number;
  /** Mode (most common) fee per operation in stroops. */
  modeFee: number;
  /** 90th-percentile fee per operation in stroops. */
  p90Fee: number;
  /** True when these values come from the fallback rather than live data. */
  isFallback: boolean;
}

export interface FeeStatsOptions {
  /** Horizon base URL (e.g. "https://horizon-testnet.stellar.org"). */
  horizonUrl: string;
  /** Retry configuration. Defaults to 3 retries, 1 s base, exponential. */
  retryOptions?: RetryOptions;
  /** Fallback returned when the live fetch fails. Defaults to FALLBACK_FEE_STATS. */
  fallback?: FeeStats;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

/**
 * Conservative fallback fee stats used when the live endpoint is unavailable.
 * Values are in stroops (1 XLM = 10_000_000 stroops).
 * 100 stroops = the Stellar base fee; 1000 stroops is a safe high-priority fee.
 */
export const FALLBACK_FEE_STATS: FeeStats = {
  minFee: 100,
  modeFee: 100,
  p90Fee: 1000,
  isFallback: true,
};

const DEFAULT_RETRY: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  exponential: true,
};

// ── Internal Horizon shape ────────────────────────────────────────────────────

interface HorizonFeeStats {
  fee_charged: {
    min: string;
    mode: string;
    p90: string;
  };
}

// ── Implementation ────────────────────────────────────────────────────────────

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function fetchRaw(horizonUrl: string): Promise<HorizonFeeStats> {
  const url = `${horizonUrl.replace(/\/$/, '')}/fee_stats`;
  let response: Response;

  try {
    response = await fetch(url);
  } catch (cause) {
    throw new NetworkError('Failed to reach Horizon fee_stats endpoint', {
      cause: cause instanceof Error ? cause : undefined,
    });
  }

  if (!response.ok) {
    throw new NetworkError(`Horizon fee_stats returned HTTP ${response.status}`, {
      statusCode: response.status,
    });
  }

  return response.json() as Promise<HorizonFeeStats>;
}

function normalize(raw: HorizonFeeStats): FeeStats {
  return {
    minFee: parseInt(raw.fee_charged.min, 10),
    modeFee: parseInt(raw.fee_charged.mode, 10),
    p90Fee: parseInt(raw.fee_charged.p90, 10),
    isFallback: false,
  };
}

/**
 * Fetch recent fee statistics from Horizon.
 *
 * Returns normalized fee stats on success, or the fallback value when all
 * retry attempts are exhausted or the endpoint returns a permanent error.
 *
 * @example
 * ```typescript
 * const fees = await fetchFeeStats({ horizonUrl: 'https://horizon-testnet.stellar.org' });
 * if (fees.isFallback) {
 *   console.warn('Using fallback fee stats');
 * }
 * console.log(`Suggested fee: ${fees.p90Fee} stroops`);
 * ```
 */
export async function fetchFeeStats(options: FeeStatsOptions): Promise<FeeStats> {
  const { horizonUrl, retryOptions = DEFAULT_RETRY, fallback = FALLBACK_FEE_STATS } = options;

  const defaultIsRetryable = (error: unknown): boolean => {
    if (error instanceof NetworkError && error.statusCode !== undefined) {
      return isRetryableStatus(error.statusCode);
    }
    return true;
  };

  try {
    const raw = await withRetry(() => fetchRaw(horizonUrl), {
      ...retryOptions,
      isRetryable: retryOptions.isRetryable ?? defaultIsRetryable,
    });

    return normalize(raw);
  } catch {
    return { ...fallback, isFallback: true };
  }
}
