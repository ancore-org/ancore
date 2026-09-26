/**
 * Unit tests for PgIdempotencyStore.
 *
 * Uses an in-process mock of pg.Pool to test persistence, TTL eviction,
 * and key lookup.
 */

import { PgIdempotencyStore } from '../../src/store/pgIdempotencyStore';

describe('PgIdempotencyStore', () => {
  it('returns undefined for an unknown key', async () => {
    const pool = {
      query: jest.fn().mockResolvedValueOnce({ rows: [], rowCount: 0 }),
    };
    const store = new PgIdempotencyStore(pool as never);

    const result = await store.get('unknown-key');
    expect(result).toBeUndefined();
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT status_code, body, expires_at FROM idempotency_keys'),
      ['unknown-key']
    );
  });

  it('returns a cached response for a valid non-expired key', async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const pool = {
      query: jest.fn().mockResolvedValueOnce({
        rows: [
          {
            key: 'k1',
            status_code: 200,
            body: { success: true, txId: 'abc' },
            expires_at: expiresAt,
          },
        ],
        rowCount: 1,
      }),
    };
    const store = new PgIdempotencyStore(pool as never);

    const result = await store.get('k1');
    expect(result).toEqual({ statusCode: 200, body: { success: true, txId: 'abc' } });
  });

  it('returns undefined and evicts when entry has expired', async () => {
    const expiredAt = new Date(Date.now() - 10_000); // 10s in the past
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              key: 'k1',
              status_code: 200,
              body: { success: true },
              expires_at: expiredAt,
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }), // DELETE eviction
    };
    const store = new PgIdempotencyStore(pool as never);

    const result = await store.get('k1');
    expect(result).toBeUndefined();
    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(pool.query.mock.calls[1][0]).toContain('DELETE FROM idempotency_keys');
  });

  it('stores a response with TTL on set', async () => {
    const pool = {
      query: jest.fn().mockResolvedValueOnce({ rows: [], rowCount: 1 }),
    };
    const store = new PgIdempotencyStore(pool as never, 10_000);

    await store.set('k2', { statusCode: 201, body: { created: true } });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][0]).toContain('INSERT INTO idempotency_keys');
    expect(pool.query.mock.calls[0][1][0]).toBe('k2');
    expect(pool.query.mock.calls[0][1][1]).toBe(201);
    expect(pool.query.mock.calls[0][1][2]).toBe(JSON.stringify({ created: true }));
  });

  it('returns the live entry count from size', async () => {
    const pool = {
      query: jest.fn().mockResolvedValueOnce({ rows: [{ count: '3' }], rowCount: 1 }),
    };
    const store = new PgIdempotencyStore(pool as never);

    const count = await store.size();
    expect(count).toBe(3);
  });

  it('deletes expired keys on clearExpired', async () => {
    const pool = {
      query: jest.fn().mockResolvedValueOnce({ rows: [], rowCount: 2 }),
    };
    const store = new PgIdempotencyStore(pool as never);

    await store.clearExpired();
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM idempotency_keys WHERE expires_at <= NOW()')
    );
  });
});
