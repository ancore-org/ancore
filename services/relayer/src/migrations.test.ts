import { readFile } from 'node:fs/promises';
import type { Pool } from 'pg';
import { runMigrations } from './migrations';

jest.mock('node:fs/promises', () => ({ readFile: jest.fn() }));

describe('runMigrations', () => {
  it('runs unapplied migrations transactionally and records them', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    const release = jest.fn();
    const pool = {
      connect: jest.fn().mockResolvedValue({ query, release }),
    } as unknown as Pool;
    (readFile as jest.Mock).mockResolvedValue('-- migration SQL');

    await runMigrations(pool, '/migrations');

    expect(readFile).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenCalledWith('COMMIT');
    expect(release).toHaveBeenCalledTimes(1);
  });
});
