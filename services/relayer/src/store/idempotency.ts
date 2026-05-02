/**
 * In-memory idempotency store with short TTL.
 *
 * Stores `idempotency-key -> CachedResponse` entries.  Expired entries are
 * evicted lazily on every `get()` call for that key.
 */

export interface CachedResponse {
  statusCode: number;
  body: unknown;
}

export class IdempotencyStore {
  private readonly store = new Map<string, { response: CachedResponse; expiresAt: number }>();

  constructor(
    /** Time-to-live for cached responses, defaults to 5 minutes */
    private readonly ttlMs: number = 5 * 60 * 1000
  ) {}

  /** Returns a cached response if the key exists and has not expired. */
  get(key: string): CachedResponse | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.response;
  }

  /** Stores a response under the given key with the configured TTL. */
  set(key: string, response: CachedResponse): void {
    this.store.set(key, {
      response,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /** Returns the number of live (non-expired) entries in the store. */
  size(): number {
    const now = Date.now();
    let count = 0;
    for (const entry of this.store.values()) {
      if (entry.expiresAt > now) count++;
    }
    return count;
  }
}
