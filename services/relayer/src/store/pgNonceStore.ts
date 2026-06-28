import { Pool } from 'pg';

export class PgNonceStore {
  constructor(private readonly pool: Pool) {}

  /**
   * Asserts that a nonce is fresh.
   * Throws an error if the nonce is already in the store.
   */
  async assertFresh(key: string, nonce: number): Promise<void> {
    const query = 'SELECT 1 FROM used_nonces WHERE account = $1 AND nonce = $2';
    const result = await this.pool.query(query, [key, nonce]);
    if (result.rowCount && result.rowCount > 0) {
      throw new Error('Nonce already used');
    }
  }

  /**
   * Records the nonce as seen for the given session key.
   */
  async track(key: string, nonce: number): Promise<void> {
    const query = `
      INSERT INTO used_nonces (account, nonce)
      VALUES ($1, $2)
      ON CONFLICT (account, nonce) DO NOTHING
    `;
    await this.pool.query(query, [key, nonce]);
  }

  /**
   * Cleans up all expired entries.
   */
  async clearExpired(): Promise<void> {
    const query = `DELETE FROM used_nonces WHERE used_at < NOW() - INTERVAL '30 days'`;
    await this.pool.query(query);
  }
}
