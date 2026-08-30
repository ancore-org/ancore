/**
 * Unit tests for PgJobQueue.
 *
 * Uses an in-process mock of pg.Pool to test all queue operations,
 * deduplication, retry/backoff, and dead-letter logic.
 */

import { PgJobQueue } from '../../src/queue/PgJobQueue';
import type { EnqueueOptions } from '../../src/queue/types';

type Row = Record<string, unknown>;

function makePgPool(rowsByQuery: Map<string, Row[]> = new Map()) {
  return {
    query: jest.fn().mockImplementation((sql: string, _params?: unknown[]) => {
      for (const [key, rows] of rowsByQuery) {
        if (sql.includes(key)) {
          return Promise.resolve({ rows, rowCount: rows.length });
        }
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    }),
  };
}

function makeJobRow(overrides: Partial<Row> = {}): Row {
  const now = new Date();
  return {
    id: 'job-uuid-1',
    idempotency_key: 'idem-key-1',
    type: 'relay_execute',
    payload: { accountAddress: 'GBBM6BKZ' },
    status: 'pending',
    attempts: 0,
    max_attempts: 5,
    created_at: now,
    updated_at: now,
    retry_after: null,
    last_error: null,
    ...overrides,
  };
}

describe('PgJobQueue', () => {
  describe('enqueue', () => {
    it('inserts a new job and returns it', async () => {
      const row = makeJobRow();
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // SELECT existing check
          .mockResolvedValueOnce({ rows: [row], rowCount: 1 }), // INSERT
      };
      const queue = new PgJobQueue(pool as never);

      const job = await queue.enqueue({
        idempotencyKey: 'idem-key-1',
        type: 'relay_execute',
        payload: { accountAddress: 'GBBM6BKZ' },
      });

      expect(pool.query).toHaveBeenCalledTimes(2);
      expect(pool.query.mock.calls[1][0]).toContain('INSERT INTO jobs');
      expect(job.id).toBe('job-uuid-1');
      expect(job.status).toBe('pending');
      expect(job.idempotencyKey).toBe('idem-key-1');
    });

    it('suppresses duplicates and returns existing non-terminal job', async () => {
      const existingRow = makeJobRow({ status: 'pending' });
      const pool = {
        query: jest.fn().mockResolvedValueOnce({ rows: [existingRow], rowCount: 1 }),
      };
      const queue = new PgJobQueue(pool as never);

      const job = await queue.enqueue({
        idempotencyKey: 'idem-key-1',
        type: 'relay_execute',
        payload: { different: true },
      });

      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(pool.query.mock.calls[0][0]).toContain('SELECT * FROM jobs');
      expect(job.id).toBe('job-uuid-1');
    });

    it('handles concurrency race when INSERT conflict occurs and re-queries', async () => {
      const existingRow = makeJobRow();
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // initial SELECT
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // INSERT ON CONFLICT DO NOTHING (conflict)
          .mockResolvedValueOnce({ rows: [existingRow], rowCount: 1 }), // fallback SELECT
      };
      const queue = new PgJobQueue(pool as never);

      const job = await queue.enqueue({
        idempotencyKey: 'idem-key-1',
        type: 'relay_execute',
        payload: {},
      });

      expect(pool.query).toHaveBeenCalledTimes(3);
      expect(job.id).toBe('job-uuid-1');
    });
  });

  describe('dequeue', () => {
    it('returns null when no eligible jobs exist', async () => {
      const pool = {
        query: jest.fn().mockResolvedValueOnce({ rows: [], rowCount: 0 }),
      };
      const queue = new PgJobQueue(pool as never);

      const result = await queue.dequeue();
      expect(result).toBeNull();
      expect(pool.query.mock.calls[0][0]).toContain('FOR UPDATE SKIP LOCKED');
    });

    it('dequeues the next pending job with ack/nack handlers', async () => {
      const row = makeJobRow({ status: 'processing' });
      const pool = {
        query: jest.fn().mockResolvedValueOnce({ rows: [row], rowCount: 1 }),
      };
      const queue = new PgJobQueue(pool as never);

      const result = await queue.dequeue();
      expect(result).not.toBeNull();
      expect(result!.job.id).toBe('job-uuid-1');
      expect(typeof result!.ack).toBe('function');
      expect(typeof result!.nack).toBe('function');
    });
  });

  describe('ack', () => {
    it('updates job status to completed', async () => {
      const pool = {
        query: jest.fn().mockResolvedValueOnce({ rows: [], rowCount: 1 }),
      };
      const queue = new PgJobQueue(pool as never);

      await queue.ack('job-uuid-1');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'completed'"),
        ['job-uuid-1']
      );
    });
  });

  describe('nack', () => {
    it('schedules a retry when attempts < max_attempts', async () => {
      const row = { attempts: 1, max_attempts: 5 };
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [row], rowCount: 1 }) // SELECT attempts
          .mockResolvedValueOnce({ rows: [], rowCount: 1 }), // UPDATE pending
      };
      const queue = new PgJobQueue(pool as never);

      await queue.nack('job-uuid-1', new Error('transient failure'));

      expect(pool.query).toHaveBeenCalledTimes(2);
      expect(pool.query.mock.calls[1][0]).toContain("SET status = 'pending'");
      expect(pool.query.mock.calls[1][1][0]).toBe(2); // attempts + 1
      expect(pool.query.mock.calls[1][1][1]).toBe('transient failure');
    });

    it('moves job to dead-letter state when attempts >= max_attempts', async () => {
      const row = { attempts: 4, max_attempts: 5 }; // will become 5 >= 5
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [row], rowCount: 1 }) // SELECT attempts
          .mockResolvedValueOnce({ rows: [], rowCount: 1 }), // UPDATE dead
      };
      const queue = new PgJobQueue(pool as never);

      await queue.nack('job-uuid-1', new Error('fatal failure'));

      expect(pool.query).toHaveBeenCalledTimes(2);
      expect(pool.query.mock.calls[1][0]).toContain("SET status = 'dead'");
      expect(pool.query.mock.calls[1][1][0]).toBe(5);
      expect(pool.query.mock.calls[1][1][1]).toBe('fatal failure');
    });
  });

  describe('accessors', () => {
    it('getById returns job when found', async () => {
      const row = makeJobRow();
      const pool = {
        query: jest.fn().mockResolvedValueOnce({ rows: [row], rowCount: 1 }),
      };
      const queue = new PgJobQueue(pool as never);

      const job = await queue.getById('job-uuid-1');
      expect(job?.id).toBe('job-uuid-1');
    });

    it('getById returns undefined when not found', async () => {
      const pool = {
        query: jest.fn().mockResolvedValueOnce({ rows: [], rowCount: 0 }),
      };
      const queue = new PgJobQueue(pool as never);

      const job = await queue.getById('missing');
      expect(job).toBeUndefined();
    });

    it('getByIdempotencyKey returns job when found', async () => {
      const row = makeJobRow();
      const pool = {
        query: jest.fn().mockResolvedValueOnce({ rows: [row], rowCount: 1 }),
      };
      const queue = new PgJobQueue(pool as never);

      const job = await queue.getByIdempotencyKey('idem-key-1');
      expect(job?.idempotencyKey).toBe('idem-key-1');
    });

    it('getDeadLetterJobs returns array of dead jobs', async () => {
      const row = makeJobRow({ status: 'dead' });
      const pool = {
        query: jest.fn().mockResolvedValueOnce({ rows: [row], rowCount: 1 }),
      };
      const queue = new PgJobQueue(pool as never);

      const dead = await queue.getDeadLetterJobs();
      expect(dead).toHaveLength(1);
      expect(dead[0].status).toBe('dead');
    });

    it('size returns count of jobs', async () => {
      const pool = {
        query: jest.fn().mockResolvedValueOnce({ rows: [{ count: '7' }], rowCount: 1 }),
      };
      const queue = new PgJobQueue(pool as never);

      const size = await queue.size();
      expect(size).toBe(7);
    });
  });
});
