/**
 * Memo-required validation helper for Stellar addresses.
 *
 * Checks whether a given destination address (such as a centralized exchange deposit)
 * requires a memo on mainnet using the StellarExpert Directory API.
 */

export interface CheckMemoRequiredOptions {
  /** Custom fetch implementation (defaults to global fetch) */
  fetchFn?: typeof fetch;
  /** In-memory cache TTL in milliseconds (default: 5 minutes = 300,000ms) */
  cacheTtlMs?: number;
  /** StellarExpert directory API base URL */
  directoryApiUrl?: string;
}

interface CacheEntry {
  memoRequired: boolean;
  expiresAt: number;
}

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_DIRECTORY_API_URL = 'https://api.stellar.expert/explorer/public/directory';

const memoRequiredCache = new Map<string, CacheEntry>();

/**
 * Clear the in-memory memo-required cache.
 * Useful for tests or resetting state.
 */
export function clearMemoRequiredCache(): void {
  memoRequiredCache.clear();
}

/**
 * Query the StellarExpert directory API to check whether a destination address requires a memo.
 *
 * @param accountAddress - The G... Stellar public key address
 * @param options - Configuration options for caching and fetch
 * @returns boolean - true if memo is required by the destination, false otherwise
 */
export async function checkMemoRequired(
  accountAddress: string,
  options: CheckMemoRequiredOptions = {}
): Promise<boolean> {
  if (!accountAddress || typeof accountAddress !== 'string') {
    return false;
  }

  const trimmedAddress = accountAddress.trim();
  if (!trimmedAddress) {
    return false;
  }

  const ttl = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const now = Date.now();

  const cached = memoRequiredCache.get(trimmedAddress);
  if (cached && cached.expiresAt > now) {
    return cached.memoRequired;
  }

  const fetchFn = options.fetchFn ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  if (!fetchFn) {
    return false;
  }

  const baseUrl = (options.directoryApiUrl ?? DEFAULT_DIRECTORY_API_URL).replace(/\/$/, '');
  const url = `${baseUrl}/${trimmedAddress}`;

  try {
    const response = await fetchFn(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (response.status === 404) {
      if (ttl > 0) {
        memoRequiredCache.set(trimmedAddress, {
          memoRequired: false,
          expiresAt: now + ttl,
        });
      }
      return false;
    }

    if (!response.ok) {
      // For 5xx or rate limiting, fail-open without caching long-term
      return false;
    }

    const data = (await response.json()) as {
      memo_required?: boolean;
      tags?: unknown[];
    } | null;
    let isRequired = false;

    if (data) {
      if (data.memo_required === true) {
        isRequired = true;
      } else if (Array.isArray(data.tags)) {
        isRequired = data.tags.some(
          (tag: unknown) => typeof tag === 'string' && tag.toLowerCase() === 'memo-required'
        );
      }
    }

    if (ttl > 0) {
      memoRequiredCache.set(trimmedAddress, {
        memoRequired: isRequired,
        expiresAt: now + ttl,
      });
    }

    return isRequired;
  } catch {
    // Network failures fail open so user is not blocked when directory is down
    return false;
  }
}
