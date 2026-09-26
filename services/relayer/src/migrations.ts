import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Pool } from 'pg';

const MIGRATIONS = [
  '001_nonce_replay.sql',
  '002_scheduled_transfers.sql',
  '003_jobs_and_idempotency.sql',
];

/** Apply each relayer migration exactly once before the service accepts traffic. */
export async function runMigrations(
  pool: Pool,
  directory = path.resolve(process.cwd(), 'migrations')
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(1362)');
    await client.query(`CREATE TABLE IF NOT EXISTS relayer_schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    for (const name of MIGRATIONS) {
      const applied = await client.query(
        'SELECT 1 FROM relayer_schema_migrations WHERE name = $1',
        [name]
      );
      if (applied.rowCount) continue;
      await client.query(await readFile(path.join(directory, name), 'utf8'));
      await client.query('INSERT INTO relayer_schema_migrations (name) VALUES ($1)', [name]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
