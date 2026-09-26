import { randomUUID } from 'crypto';
import type { Pool } from 'pg';
import type {
  Job,
  JobStatus,
  JobType,
  EnqueueOptions,
  DequeueResult,
  JobQueueContract,
} from './types';
import { nextRetryAfter } from './backoff';

const DEFAULT_MAX_ATTEMPTS = 5;

interface JobRow {
  id: string;
  idempotency_key: string;
  type: JobType;
  payload: unknown;
  status: JobStatus;
  attempts: number | string;
  max_attempts: number | string;
  created_at: Date | string;
  updated_at: Date | string;
  retry_after: Date | string | null;
  last_error: string | null;
}

function rowToJob<T = unknown>(row: JobRow): Job<T> {
  const payload =
    typeof row.payload === 'string' ? (JSON.parse(row.payload) as T) : (row.payload as T);

  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    type: row.type,
    payload,
    status: row.status,
    attempts: typeof row.attempts === 'string' ? parseInt(row.attempts, 10) : Number(row.attempts),
    maxAttempts:
      typeof row.max_attempts === 'string'
        ? parseInt(row.max_attempts, 10)
        : Number(row.max_attempts),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(row.created_at).toISOString(),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : new Date(row.updated_at).toISOString(),
    retryAfter: row.retry_after
      ? row.retry_after instanceof Date
        ? row.retry_after.toISOString()
        : new Date(row.retry_after).toISOString()
      : undefined,
    lastError: row.last_error ?? undefined,
  };
}

/**
 * PostgreSQL-backed persistent job queue with idempotency, retry/backoff,
 * dead-letter support, and atomic FIFO dequeue using `FOR UPDATE SKIP LOCKED`.
 */
export class PgJobQueue implements JobQueueContract {
  constructor(private readonly pool: Pool) {}

  // ── Enqueue ────────────────────────────────────────────────────────────────

  /**
   * Enqueue a new job.
   *
   * If a job with the same `idempotencyKey` already exists and is not in a
   * terminal state (`completed` | `dead`), the existing job is returned
   * unchanged (duplicate suppression).
   */
  async enqueue(options: EnqueueOptions): Promise<Job> {
    const { idempotencyKey, type, payload, maxAttempts = DEFAULT_MAX_ATTEMPTS } = options;

    // Check for existing active job first (duplicate suppression)
    const existing = await this.pool.query<JobRow>(
      `SELECT * FROM jobs
       WHERE idempotency_key = $1 AND status NOT IN ('completed', 'dead')
       ORDER BY created_at DESC
       LIMIT 1`,
      [idempotencyKey]
    );

    if (existing.rows.length > 0) {
      return rowToJob(existing.rows[0]);
    }

    const id = randomUUID();
    const payloadJson = JSON.stringify(payload);

    try {
      const result = await this.pool.query<JobRow>(
        `INSERT INTO jobs
           (id, idempotency_key, type, payload, status, attempts, max_attempts, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'pending', 0, $5, NOW(), NOW())
         ON CONFLICT (idempotency_key) WHERE status NOT IN ('completed', 'dead') DO NOTHING
         RETURNING *`,
        [id, idempotencyKey, type, payloadJson, maxAttempts]
      );

      if (result.rows.length > 0) {
        return rowToJob(result.rows[0]);
      }
    } catch {
      // In case of unique violation race, fall through to re-query
    }

    // If ON CONFLICT did nothing due to a concurrent insert, fetch the inserted job
    const raceResult = await this.pool.query<JobRow>(
      `SELECT * FROM jobs
       WHERE idempotency_key = $1 AND status NOT IN ('completed', 'dead')
       ORDER BY created_at DESC
       LIMIT 1`,
      [idempotencyKey]
    );

    if (raceResult.rows.length > 0) {
      return rowToJob(raceResult.rows[0]);
    }

    throw new Error(`Failed to enqueue job with idempotencyKey "${idempotencyKey}"`);
  }

  // ── Dequeue ────────────────────────────────────────────────────────────────

  /**
   * Atomically dequeue the next eligible pending job (FIFO by `created_at`)
   * using `FOR UPDATE SKIP LOCKED` to prevent race conditions across concurrent workers.
   */
  async dequeue<T = unknown>(): Promise<DequeueResult<T> | null> {
    const result = await this.pool.query<JobRow>(
      `WITH next_job AS (
         SELECT id FROM jobs
         WHERE status = 'pending'
           AND (retry_after IS NULL OR retry_after <= NOW())
         ORDER BY created_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE jobs j
       SET status = 'processing',
           updated_at = NOW()
       FROM next_job
       WHERE j.id = next_job.id
       RETURNING j.*`
    );

    if (result.rows.length === 0) {
      return null;
    }

    const job = rowToJob<T>(result.rows[0]);

    return {
      job,
      ack: () => this.ack(job.id),
      nack: (error: Error) => this.nack(job.id, error),
    };
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  async getById(id: string): Promise<Job | undefined> {
    const result = await this.pool.query<JobRow>(`SELECT * FROM jobs WHERE id = $1`, [id]);
    return result.rows.length > 0 ? rowToJob(result.rows[0]) : undefined;
  }

  async getByIdempotencyKey(key: string): Promise<Job | undefined> {
    const result = await this.pool.query<JobRow>(
      `SELECT * FROM jobs
       WHERE idempotency_key = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [key]
    );
    return result.rows.length > 0 ? rowToJob(result.rows[0]) : undefined;
  }

  async getDeadLetterJobs(): Promise<Job[]> {
    const result = await this.pool.query<JobRow>(
      `SELECT * FROM jobs
       WHERE status = 'dead'
       ORDER BY created_at DESC`
    );
    return result.rows.map(rowToJob);
  }

  async size(): Promise<number> {
    const result = await this.pool.query<{ count: string | number }>(
      `SELECT COUNT(*)::int AS count FROM jobs`
    );
    if (result.rows.length === 0) return 0;
    return typeof result.rows[0].count === 'string'
      ? parseInt(result.rows[0].count, 10)
      : Number(result.rows[0].count);
  }

  // ── Internal / Lifecycle ───────────────────────────────────────────────────

  async ack(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE jobs
       SET status = 'completed',
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }

  async nack(id: string, error: Error): Promise<void> {
    const result = await this.pool.query<JobRow>(
      `SELECT attempts, max_attempts FROM jobs WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) return;

    const currentAttempts =
      typeof result.rows[0].attempts === 'string'
        ? parseInt(result.rows[0].attempts, 10)
        : Number(result.rows[0].attempts);
    const maxAttempts =
      typeof result.rows[0].max_attempts === 'string'
        ? parseInt(result.rows[0].max_attempts, 10)
        : Number(result.rows[0].max_attempts);

    const attempts = currentAttempts + 1;
    const errorMessage = error.message;

    if (attempts >= maxAttempts) {
      await this.pool.query(
        `UPDATE jobs
         SET status = 'dead',
             attempts = $1,
             last_error = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [attempts, errorMessage, id]
      );
    } else {
      const retryAfterIso = nextRetryAfter(attempts);
      await this.pool.query(
        `UPDATE jobs
         SET status = 'pending',
             attempts = $1,
             last_error = $2,
             retry_after = $3,
             updated_at = NOW()
         WHERE id = $4`,
        [attempts, errorMessage, new Date(retryAfterIso), id]
      );
    }
  }
}
