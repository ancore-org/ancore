/**
 * Account sequence fetch helper with retries, caching, and typed errors.
 *
 * Provides a robust way to fetch Stellar account sequence numbers with
 * proper error handling for unfunded accounts, rate limits, and network errors.
 */

import { Horizon } from '@stellar/stellar-sdk';
import { withRetry, type RetryOptions } from './retry';
import { AccountNotFoundError, NetworkError } from './errors';

/**
 * Configuration options for fetching account sequence.
 */
export interface FetchAccountSequenceOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Time-to-live for cache in milliseconds (default: 5000, set to 0 to disable) */
  cacheTtlMs?: number;
  /** Whether to use jitter in retry delays (default: true) */
  useJitter?: boolean;
}

/**
 * Result of fetching account sequence.
 */
export interface AccountSequenceResult {
  /** The account sequence number */
  sequence: bigint;
  /** The account ID (public key) */
  accountId: string;
  /** Timestamp when the sequence was fetched */
  fetchedAt: number;
}

/**
 * In-memory cache entry for account sequences.
 */
interface CacheEntry {
  sequence: bigint;
  fetchedAt: number;
  expiresAt: number;
}

/**
 * Default cache TTL: 5 seconds.
 * Short TTL ensures sequence numbers stay relatively fresh while
 * providing some protection against rapid successive fetches.
 */
const DEFAULT_CACHE_TTL_MS = 5000;

/**
 * In-memory cache for account sequences.
 * Key is accountId, value is cache entry.
 */
const sequenceCache = new Map<string, CacheEntry>();

/**
 * Clear the sequence cache.
 * Useful for testing or when you need to force a fresh fetch.
 */
export function clearSequenceCache(): void {
  sequenceCache.clear();
}

/**
 * Fetch the sequence number for a Stellar account from Horizon.
 *
 * Handles:
 * - 404 errors for unfunded accounts (throws AccountNotFoundError)
 * - 429 rate limit errors (retries with exponential backoff)
 * - 5xx server errors (retries with exponential backoff)
 * - Network errors (retries with exponential backoff)
 *
 * Uses in-memory caching with configurable TTL to reduce redundant fetches.
 *
 * @param horizonServer - The Horizon server instance
 * @param accountId - The Stellar account ID (public key)
 * @param options - Configuration options for retries and caching
 * @returns The account sequence number as a bigint
 * @throws {AccountNotFoundError} If the account is not found (unfunded)
 * @throws {NetworkError} If the request fails after retries
 *
 * @example
 * ```typescript
 * const horizon = new Horizon.Server('https://horizon-testnet.stellar.org');
 * const sequence = await fetchAccountSequence(horizon, 'GABC...', {
 *   maxRetries: 3,
 *   cacheTtlMs: 5000,
 * });
 * ```
 */
export async function fetchAccountSequence(
  horizonServer: Horizon.Server,
  accountId: string,
  options: FetchAccountSequenceOptions = {}
): Promise<AccountSequenceResult> {
  const { maxRetries = 3, cacheTtlMs = DEFAULT_CACHE_TTL_MS, useJitter = true } = options;

  // Check cache first
  if (cacheTtlMs > 0) {
    const cached = sequenceCache.get(accountId);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      return {
        sequence: cached.sequence,
        accountId,
        fetchedAt: cached.fetchedAt,
      };
    }

    // Remove expired entry
    if (cached) {
      sequenceCache.delete(accountId);
    }
  }

  // Build retry options
  const retryOptions: RetryOptions = {
    maxRetries,
    baseDelayMs: 200, // Start with 200ms
    exponential: true,
    isRetryable: (error) => {
      // Don't retry account not found errors
      if (error instanceof AccountNotFoundError) {
        return false;
      }

      // Retry rate limit, server errors, and unknown-status network errors
      // (unknown status = likely a connection/DNS/timeout error, which are transient)
      if (error instanceof NetworkError) {
        const statusCode = error.statusCode;
        return statusCode === undefined || statusCode === 429 || statusCode >= 500;
      }

      // Retry other network errors by default
      return true;
    },
  };

  // Add jitter if enabled
  if (useJitter) {
    // Jitter is already applied in the retry helper via exponential backoff
    // This flag is for future enhancement if needed
  }

  // Fetch with retry logic
  try {
    const account = await withRetry(async () => {
      try {
        return await horizonServer.loadAccount(accountId);
      } catch (error) {
        const statusCode = getStatusCode(error);

        // Handle 404 - account not found (unfunded)
        if (statusCode === 404 || (error instanceof Error && error.message.includes('Not Found'))) {
          throw new AccountNotFoundError(accountId);
        }

        // Convert other errors to NetworkError for retry logic
        if (error instanceof Error) {
          throw new NetworkError(`Failed to fetch account sequence: ${error.message}`, {
            cause: error,
            statusCode,
            retryable: statusCode === 429 || (statusCode !== undefined && statusCode >= 500),
          });
        }

        throw new NetworkError('Failed to fetch account sequence', {
          cause: error instanceof Error ? error : undefined,
        });
      }
    }, retryOptions);

    const sequence = BigInt(account.sequence);

    // Cache the result
    if (cacheTtlMs > 0) {
      const now = Date.now();
      sequenceCache.set(accountId, {
        sequence,
        fetchedAt: now,
        expiresAt: now + cacheTtlMs,
      });
    }

    return {
      sequence,
      accountId,
      fetchedAt: Date.now(),
    };
  } catch (error) {
    // Re-throw our custom errors
    if (error instanceof AccountNotFoundError || error instanceof NetworkError) {
      throw error;
    }

    // Wrap unexpected errors
    throw new NetworkError('Failed to fetch account sequence after retries', {
      cause: error instanceof Error ? error : undefined,
    });
  }
}

/**
 * Extract HTTP status code from various error shapes.
 */
function getStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  if ('statusCode' in error && typeof error.statusCode === 'number') {
    return error.statusCode;
  }

  if ('status' in error && typeof error.status === 'number') {
    return error.status;
  }

  if (
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'status' in error.response &&
    typeof error.response.status === 'number'
  ) {
    return error.response.status;
  }

  return undefined;
}
