import type { Pool } from 'pg';
import type { CachedResponse, IdempotencyStoreContract } from './idempotency';

interface IdempotencyRow {
  key: string;
  status_code: number | string;
  body: unknown;
  created_at: Date | string;
  expires_at: Date | string;
}

/**
 * PostgreSQL-backed persistent idempotency store with TTL support.
 *
 * Persists cached responses in the `idempotency_keys` table (migration 003).
 * Enables response deduplication across multiple relayer instances behind
 * a load balancer and survives service restarts.
 */
export class PgIdempotencyStore implements IdempotencyStoreContract {
  constructor(
    private readonly pool: Pool,
    /** Time-to-live for cached responses, defaults to 5 minutes */
    private readonly ttlMs: number = 5 * 60 * 1000
  ) {}

  /**
   * Returns a cached response if the key exists and has not expired.
   * Lazily evicts expired entries.
   */
  async get(key: string): Promise<CachedResponse | undefined> {
    const result = await this.pool.query<IdempotencyRow>(
      `SELECT status_code, body, expires_at FROM idempotency_keys WHERE key = $1`,
      [key]
    );

    if (result.rows.length === 0) {
      return undefined;
    }

    const row = result.rows[0];
    const expiresAt =
      row.expires_at instanceof Date
        ? row.expires_at.getTime()
        : new Date(row.expires_at).getTime();

    if (Date.now() > expiresAt) {
      // Lazily evict expired row
      await this.pool
        .query(`DELETE FROM idempotency_keys WHERE key = $1`, [key])
        .catch(() => {});
      return undefined;
    }

    const body =
      typeof row.body === 'string' ? JSON.parse(row.body) : row.body;
    const statusCode =
      typeof row.status_code === 'string'
        ? parseInt(row.status_code, 10)
        : Number(row.status_code);

    return { statusCode, body };
  }

  /**
   * Stores or updates a response under the given key with the configured TTL.
   */
  async set(key: string, response: CachedResponse): Promise<void> {
    const expiresAt = new Date(Date.now() + this.ttlMs);
    const bodyJson = JSON.stringify(response.body);

    await this.pool.query(
      `INSERT INTO idempotency_keys (key, status_code, body, created_at, expires_at)
       VALUES ($1, $2, $3, NOW(), $4)
       ON CONFLICT (key) DO UPDATE
         SET status_code = EXCLUDED.status_code,
             body = EXCLUDED.body,
             created_at = NOW(),
             expires_at = EXCLUDED.expires_at`,
      [key, response.statusCode, bodyJson, expiresAt]
    );
  }

  /**
   * Returns the number of live (non-expired) entries in the store.
   */
  async size(): Promise<number> {
    const result = await this.pool.query<{ count: string | number }>(
      `SELECT COUNT(*)::int AS count FROM idempotency_keys WHERE expires_at > NOW()`
    );

    if (result.rows.length === 0) return 0;
    return typeof result.rows[0].count === 'string'
      ? parseInt(result.rows[0].count, 10)
      : Number(result.rows[0].count);
  }

  /**
   * Purges all expired entries from the idempotency table.
   */
  async clearExpired(): Promise<void> {
    await this.pool.query(`DELETE FROM idempotency_keys WHERE expires_at <= NOW()`);
  }
}
