/**
 * Multi-instance concurrency and persistence tests.
 *
 * Verifies that:
 *  1. Two separate relayer instances behind a load balancer sharing the same
 *     database correctly deduplicate retried requests via PgIdempotencyStore.
 *  2. Two concurrent workers sharing the same PgJobQueue never double-process
 *     the same job (atomic dequeue / concurrency safety).
 *  3. Concurrent enqueue calls with the same idempotency key across multiple
 *     instances yield the same job (duplicate suppression).
 *  4. Service restarts preserve pending jobs and idempotency state.
 */

import request from 'supertest';
import { createApp } from '../../src/server';
import { PgJobQueue } from '../../src/queue/PgJobQueue';
import { PgIdempotencyStore } from '../../src/store/pgIdempotencyStore';
import { QueueWorker } from '../../src/workers/QueueWorker';
import type { Job, JobStatus, JobType } from '../../src/queue/types';

interface SimulatedJobRow {
  id: string;
  idempotency_key: string;
  type: JobType;
  payload: string;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  created_at: Date;
  updated_at: Date;
  retry_after: Date | null;
  last_error: string | null;
  locked_by?: string | null;
}

interface SimulatedIdempotencyRow {
  key: string;
  status_code: number;
  body: string;
  created_at: Date;
  expires_at: Date;
}

/**
 * Creates an in-process simulated PostgreSQL pool that maintains shared state
 * across multiple store/service instances.
 */
function createSharedPostgresDatabase() {
  const jobsTable: SimulatedJobRow[] = [];
  const idempotencyTable = new Map<string, SimulatedIdempotencyRow>();

  const pool = {
    query: jest.fn().mockImplementation(async (sql: string, params: unknown[] = []) => {
      const trimmed = sql.trim();

      // ── IDEMPOTENCY QUERIES ────────────────────────────────────────────────

      if (trimmed.startsWith('SELECT status_code, body, expires_at FROM idempotency_keys')) {
        const key = params[0] as string;
        const entry = idempotencyTable.get(key);
        if (!entry) {
          return { rows: [], rowCount: 0 };
        }
        return {
          rows: [
            {
              status_code: entry.status_code,
              body: entry.body,
              expires_at: entry.expires_at,
            },
          ],
          rowCount: 1,
        };
      }

      if (trimmed.startsWith('INSERT INTO idempotency_keys')) {
        const [key, statusCode, bodyJson, expiresAt] = params as [
          string,
          number,
          string,
          Date,
        ];
        idempotencyTable.set(key, {
          key,
          status_code: statusCode,
          body: bodyJson,
          created_at: new Date(),
          expires_at: expiresAt,
        });
        return { rows: [], rowCount: 1 };
      }

      if (trimmed.startsWith('DELETE FROM idempotency_keys WHERE key =')) {
        const key = params[0] as string;
        idempotencyTable.delete(key);
        return { rows: [], rowCount: 1 };
      }

      if (trimmed.startsWith('SELECT COUNT(*)::int AS count FROM idempotency_keys')) {
        const now = Date.now();
        let count = 0;
        for (const entry of idempotencyTable.values()) {
          if (entry.expires_at.getTime() > now) count++;
        }
        return { rows: [{ count }], rowCount: 1 };
      }

      // ── JOB QUEUE QUERIES ──────────────────────────────────────────────────

      if (trimmed.includes('SELECT * FROM jobs') && trimmed.includes('idempotency_key = $1')) {
        const key = params[0] as string;
        const active = jobsTable
          .filter((j) => j.idempotency_key === key && j.status !== 'completed' && j.status !== 'dead')
          .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

        return { rows: active, rowCount: active.length };
      }

      if (trimmed.includes('INSERT INTO jobs')) {
        const [id, key, type, payloadJson, maxAttempts] = params as [
          string,
          string,
          JobType,
          string,
          number,
        ];

        // Check unique constraint for active status
        const existingActive = jobsTable.find(
          (j) => j.idempotency_key === key && j.status !== 'completed' && j.status !== 'dead'
        );

        if (existingActive) {
          // ON CONFLICT DO NOTHING
          return { rows: [], rowCount: 0 };
        }

        const now = new Date();
        const newRow: SimulatedJobRow = {
          id,
          idempotency_key: key,
          type,
          payload: payloadJson,
          status: 'pending',
          attempts: 0,
          max_attempts: maxAttempts,
          created_at: now,
          updated_at: now,
          retry_after: null,
          last_error: null,
        };
        jobsTable.push(newRow);
        return { rows: [newRow], rowCount: 1 };
      }

      if (trimmed.includes('WITH next_job AS') && trimmed.includes('FOR UPDATE SKIP LOCKED')) {
        const now = Date.now();
        const candidateIndex = jobsTable.findIndex(
          (j) =>
            j.status === 'pending' &&
            (!j.retry_after || j.retry_after.getTime() <= now) &&
            !j.locked_by
        );

        if (candidateIndex === -1) {
          return { rows: [], rowCount: 0 };
        }

        const candidate = jobsTable[candidateIndex];
        candidate.status = 'processing';
        candidate.updated_at = new Date();
        return { rows: [candidate], rowCount: 1 };
      }

      if (trimmed.includes("SET status = 'completed'") && trimmed.includes('UPDATE jobs')) {
        const id = params[0] as string;
        const job = jobsTable.find((j) => j.id === id);
        if (job) {
          job.status = 'completed';
          job.updated_at = new Date();
        }
        return { rows: [], rowCount: job ? 1 : 0 };
      }

      if (trimmed.includes('SELECT attempts, max_attempts FROM jobs WHERE id = $1')) {
        const id = params[0] as string;
        const job = jobsTable.find((j) => j.id === id);
        if (!job) return { rows: [], rowCount: 0 };
        return {
          rows: [{ attempts: job.attempts, max_attempts: job.max_attempts }],
          rowCount: 1,
        };
      }

      if (trimmed.includes("SET status = 'dead'") && trimmed.includes('UPDATE jobs')) {
        const [attempts, lastError, id] = params as [number, string, string];
        const job = jobsTable.find((j) => j.id === id);
        if (job) {
          job.status = 'dead';
          job.attempts = attempts;
          job.last_error = lastError;
          job.updated_at = new Date();
        }
        return { rows: [], rowCount: job ? 1 : 0 };
      }

      if (trimmed.includes("SET status = 'pending'") && trimmed.includes('UPDATE jobs')) {
        const [attempts, lastError, retryAfter, id] = params as [
          number,
          string,
          Date,
          string,
        ];
        const job = jobsTable.find((j) => j.id === id);
        if (job) {
          job.status = 'pending';
          job.attempts = attempts;
          job.last_error = lastError;
          job.retry_after = retryAfter;
          job.updated_at = new Date();
        }
        return { rows: [], rowCount: job ? 1 : 0 };
      }

      if (trimmed.includes('SELECT * FROM jobs WHERE id = $1')) {
        const id = params[0] as string;
        const job = jobsTable.find((j) => j.id === id);
        return { rows: job ? [job] : [], rowCount: job ? 1 : 0 };
      }

      if (trimmed.includes('SELECT COUNT(*)::int AS count FROM jobs')) {
        return { rows: [{ count: jobsTable.length }], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    }),
  };

  return { pool, jobsTable, idempotencyTable };
}

describe('Multi-Instance Concurrency & Persistence', () => {
  describe('Idempotency Store cross-instance deduplication', () => {
    it('deduplicates requests across two relayer instances sharing the same Postgres pool', async () => {
      const { pool } = createSharedPostgresDatabase();

      const storeInstance1 = new PgIdempotencyStore(pool as never);
      const storeInstance2 = new PgIdempotencyStore(pool as never);

      const mockSignatureService = { verify: () => true };

      const appInstance1 = createApp(
        undefined,
        mockSignatureService,
        storeInstance1,
        undefined,
        { useMockSubmission: true, startScheduler: false },
        undefined,
        undefined,
        undefined,
        pool as never
      );

      const appInstance2 = createApp(
        undefined,
        mockSignatureService,
        storeInstance2,
        undefined,
        { useMockSubmission: true, startScheduler: false },
        undefined,
        undefined,
        undefined,
        pool as never
      );

      const payload = {
        sessionKey: 'a'.repeat(64),
        operation: 'relay_execute',
        parameters: {},
        signature: 'b'.repeat(128),
        nonce: 10,
      };

      const idempotencyKey = 'shared-idem-key-999';

      // 1. Send request to Instance 1
      const res1 = await request(appInstance1)
        .post('/relay/execute')
        .set('Authorization', 'Bearer token')
        .set('idempotency-key', idempotencyKey)
        .send(payload);

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      const firstTransactionId = res1.body.transactionId;

      // 2. Send the same idempotent request to Instance 2 (behind load balancer)
      const res2 = await request(appInstance2)
        .post('/relay/execute')
        .set('Authorization', 'Bearer token')
        .set('idempotency-key', idempotencyKey)
        .send(payload);

      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);
      // Must return identical transaction ID from the shared database
      expect(res2.body.transactionId).toBe(firstTransactionId);
    });
  });

  describe('JobQueue multi-worker concurrency', () => {
    it('ensures only one instance dequeues and processes a job when polling concurrently', async () => {
      const { pool } = createSharedPostgresDatabase();

      const queueInstance1 = new PgJobQueue(pool as never);
      const queueInstance2 = new PgJobQueue(pool as never);

      // Enqueue 1 job via instance 1
      const job = await queueInstance1.enqueue({
        idempotencyKey: 'concurrent-job-1',
        type: 'relay_execute',
        payload: { amount: 100 },
      });

      expect(job.id).toBeDefined();

      // Instance 1 and Instance 2 attempt to dequeue at the exact same moment
      const [dequeued1, dequeued2] = await Promise.all([
        queueInstance1.dequeue(),
        queueInstance2.dequeue(),
      ]);

      // Exactly ONE worker must have acquired the job
      const acquiredCount = (dequeued1 !== null ? 1 : 0) + (dequeued2 !== null ? 1 : 0);
      expect(acquiredCount).toBe(1);

      const acquiredResult = dequeued1 ?? dequeued2!;
      expect(acquiredResult.job.id).toBe(job.id);
      expect(acquiredResult.job.status).toBe('processing');

      // Acknowledge the job
      await acquiredResult.ack();

      // Subsequent dequeue calls on either instance return null
      expect(await queueInstance1.dequeue()).toBeNull();
      expect(await queueInstance2.dequeue()).toBeNull();
    });

    it('suppresses duplicate jobs enqueued concurrently from multiple instances', async () => {
      const { pool } = createSharedPostgresDatabase();

      const queueInstance1 = new PgJobQueue(pool as never);
      const queueInstance2 = new PgJobQueue(pool as never);

      const [job1, job2] = await Promise.all([
        queueInstance1.enqueue({
          idempotencyKey: 'duplicate-race-key',
          type: 'relay_execute',
          payload: { order: 1 },
        }),
        queueInstance2.enqueue({
          idempotencyKey: 'duplicate-race-key',
          type: 'relay_execute',
          payload: { order: 2 },
        }),
      ]);

      expect(job1.id).toBe(job2.id);
      expect(await queueInstance1.size()).toBe(1);
    });
  });

  describe('Persistence across restart', () => {
    it('retains pending jobs and idempotency cache across simulated process restart', async () => {
      const { pool } = createSharedPostgresDatabase();

      // ── Process 1 (before restart) ──────────────────────────────────────────
      const queue1 = new PgJobQueue(pool as never);
      const idempotency1 = new PgIdempotencyStore(pool as never);

      await queue1.enqueue({
        idempotencyKey: 'restart-job-1',
        type: 'relay_execute',
        payload: { persistent: true },
      });

      await idempotency1.set('persisted-key-1', {
        statusCode: 200,
        body: { cachedResult: 'ok' },
      });

      // Simulate crash / restart by dropping references to queue1 & idempotency1
      // ── Process 2 (after restart) ───────────────────────────────────────────
      const queue2 = new PgJobQueue(pool as never);
      const idempotency2 = new PgIdempotencyStore(pool as never);

      // Idempotency state survived
      const cached = await idempotency2.get('persisted-key-1');
      expect(cached).toEqual({
        statusCode: 200,
        body: { cachedResult: 'ok' },
      });

      // Pending job survived and can be dequeued
      const result = await queue2.dequeue();
      expect(result).not.toBeNull();
      expect(result!.job.idempotencyKey).toBe('restart-job-1');
      await result!.ack();
    });
  });
});
