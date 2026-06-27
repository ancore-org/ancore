/**
 * In-memory store to track seen nonces per session key with a configured TTL.
 * Prevents replay attacks by ensuring that nonces are only used once per session key.
 */

export interface NonceStore {
  assertFresh(key: string, nonce: number): void | Promise<void>;
  track(key: string, nonce: number): void | Promise<void>;
  clearExpired(): void | Promise<void>;
}

export class MemoryNonceStore implements NonceStore {
  // Store structure: sessionKey -> Map<nonce, expiresAt>
  private readonly seen = new Map<string, Map<number, number>>();

  constructor(
    /** Time-to-live for seen nonces in milliseconds, defaults to 5 minutes */
    private readonly ttlMs: number = 5 * 60 * 1000
  ) {}

  /**
   * Asserts that a nonce is fresh (i.e. has not been seen within its TTL).
   * Throws an error if the nonce is already in the store.
   */
  assertFresh(key: string, nonce: number): void {
    this.evictExpired(key);

    const keyStore = this.seen.get(key);
    if (keyStore && keyStore.has(nonce)) {
      throw new Error('Nonce already used');
    }
  }

  /**
   * Records the nonce as seen for the given session key.
   */
  track(key: string, nonce: number): void {
    this.evictExpired(key);

    let keyStore = this.seen.get(key);
    if (!keyStore) {
      keyStore = new Map<number, number>();
      this.seen.set(key, keyStore);
    }
    keyStore.set(nonce, Date.now() + this.ttlMs);
  }

  /**
   * Evicts expired nonces for a given session key.
   */
  private evictExpired(key: string): void {
    const keyStore = this.seen.get(key);
    if (!keyStore) return;

    const now = Date.now();
    for (const [nonce, expiresAt] of keyStore.entries()) {
      if (now > expiresAt) {
        keyStore.delete(nonce);
      }
    }

    if (keyStore.size === 0) {
      this.seen.delete(key);
    }
  }

  /**
   * Returns the number of non-expired tracked nonces for a given session key.
   * Useful for assertions in test suites.
   */
  size(key: string): number {
    this.evictExpired(key);
    return this.seen.get(key)?.size ?? 0;
  }

  /**
   * Cleans up all expired entries across all session keys.
   */
  clearExpired(): void {
    const now = Date.now();
    for (const [key, keyStore] of this.seen.entries()) {
      for (const [nonce, expiresAt] of keyStore.entries()) {
        if (now > expiresAt) {
          keyStore.delete(nonce);
        }
      }
      if (keyStore.size === 0) {
        this.seen.delete(key);
      }
    }
  }
}
