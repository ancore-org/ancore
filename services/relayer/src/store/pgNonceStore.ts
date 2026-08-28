import { Pool } from 'pg';
import { rootLogger, redactSessionKey } from '../logging';
import { nonceOperations } from '../metrics';

export class PgNonceStore {
  constructor(private readonly pool: Pool) {}

  /**
   * Asserts that a nonce is fresh.
   * Throws an error if the nonce is already in the store.
   */
  async assertFresh(key: string, nonce: number): Promise<void> {
    try {
      const query = 'SELECT 1 FROM used_nonces WHERE account = $1 AND nonce = $2';
      const result = await this.pool.query(query, [key, nonce]);
      if (result.rowCount && result.rowCount > 0) {
        nonceOperations.increment('replay');
        rootLogger.warn(
          { key: redactSessionKey(key), nonce, status: 'replay', outcome: 'validation_failed' },
          'Nonce replay detected'
        );
        throw new Error('Nonce already used');
      }
      nonceOperations.increment('valid');
      rootLogger.debug(
        { key: redactSessionKey(key), nonce, status: 'valid', outcome: 'success' },
        'Nonce asserted fresh'
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'Nonce already used') {
        throw err;
      }
      nonceOperations.increment('error');
      const errorMessage = err instanceof Error ? err.message : String(err);
      rootLogger.error(
        { key: redactSessionKey(key), nonce, outcome: 'error', error: errorMessage },
        'PgNonceStore assertFresh query failed'
      );
      throw err;
    }
  }

  /**
   * Records the nonce as seen for the given session key.
   */
  async track(key: string, nonce: number): Promise<void> {
    try {
      const query = `
        INSERT INTO used_nonces (account, nonce)
        VALUES ($1, $2)
        ON CONFLICT (account, nonce) DO NOTHING
      `;
      await this.pool.query(query, [key, nonce]);
    } catch (err: unknown) {
      nonceOperations.increment('error');
      const errorMessage = err instanceof Error ? err.message : String(err);
      rootLogger.error(
        { key: redactSessionKey(key), nonce, outcome: 'error', error: errorMessage },
        'PgNonceStore track query failed'
      );
      throw err;
    }
  }

  /**
   * Cleans up all expired entries.
   */
  async clearExpired(): Promise<void> {
    try {
      const query = `DELETE FROM used_nonces WHERE used_at < NOW() - INTERVAL '30 days'`;
      await this.pool.query(query);
    } catch (err: unknown) {
      nonceOperations.increment('error');
      const errorMessage = err instanceof Error ? err.message : String(err);
      rootLogger.error(
        { outcome: 'error', error: errorMessage },
        'PgNonceStore clearExpired query failed'
      );
      throw err;
    }
  }
}
