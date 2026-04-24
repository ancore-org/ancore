import { randomUUID } from 'crypto';
import type { Job, EnqueueOptions, DequeueResult, JobStatus } from './types';
import { nextRetryAfter } from './backoff';

const DEFAULT_MAX_ATTEMPTS = 5;

/**
 * In-memory job queue with idempotency, retry/backoff, and dead-letter support.
 *
 * Designed to be swapped for a persistent backend (Redis, Postgres, etc.) by
 * implementing the same interface.
 */
export class JobQueue {
  /** Primary store: jobId → Job */
  private readonly jobs = new Map<string, Job>();
  /** Idempotency index: idempotencyKey → jobId */
  private readonly idempotencyIndex = new Map<string, string>();

  // ── Enqueue ────────────────────────────────────────────────────────────────

  /**
   * Enqueue a new job.
   *
   * If a job with the same `idempotencyKey` already exists and is not in a
   * terminal state (`completed` | `dead`), the existing job is returned
   * unchanged (duplicate suppression).
   *
   * @returns The newly created job, or the existing job if suppressed.
   */
  enqueue(options: EnqueueOptions): Job {
    const { idempotencyKey, type, payload, maxAttempts = DEFAULT_MAX_ATTEMPTS } = options;

    const existingId = this.idempotencyIndex.get(idempotencyKey);
    if (existingId) {
      const existing = this.jobs.get(existingId);
      if (existing && !this.isTerminal(existing.status)) {
        // Duplicate — return existing job without re-enqueuing
        return existing;
      }
    }

    const now = new Date().toISOString();
    const job: Job = {
      id: randomUUID(),
      idempotencyKey,
      type,
      payload,
      status: 'pending',
      attempts: 0,
      maxAttempts,
      createdAt: now,
      updatedAt: now,
    };

    this.jobs.set(job.id, job);
    this.idempotencyIndex.set(idempotencyKey, job.id);
    return job;
  }

  // ── Dequeue ────────────────────────────────────────────────────────────────

  /**
   * Dequeue the next eligible pending job (FIFO by `createdAt`).
   *
   * Returns `null` when no eligible job is available.
   * The caller must call `ack()` on success or `nack(error)` on failure.
   */
  dequeue<T = unknown>(): DequeueResult<T> | null {
    const now = new Date();

    const candidate = [...this.jobs.values()]
      .filter((j) => {
        if (j.status !== 'pending') return false;
        if (j.retryAfter && new Date(j.retryAfter) > now) return false;
        return true;
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];

    if (!candidate) return null;

    this.update(candidate.id, { status: 'processing', updatedAt: new Date().toISOString() });
    const job = this.jobs.get(candidate.id) as Job<T>;

    return {
      job,
      ack: () => this.ack(job.id),
      nack: (error: Error) => this.nack(job.id, error),
    };
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  getById(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  getByIdempotencyKey(key: string): Job | undefined {
    const id = this.idempotencyIndex.get(key);
    return id ? this.jobs.get(id) : undefined;
  }

  /** All jobs currently in the dead-letter state */
  getDeadLetterJobs(): Job[] {
    return [...this.jobs.values()].filter((j) => j.status === 'dead');
  }

  size(): number {
    return this.jobs.size;
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private ack(id: string): void {
    this.update(id, { status: 'completed', updatedAt: new Date().toISOString() });
  }

  private nack(id: string, error: Error): void {
    const job = this.jobs.get(id);
    if (!job) return;

    const attempts = job.attempts + 1;

    if (attempts >= job.maxAttempts) {
      this.update(id, {
        status: 'dead',
        attempts,
        lastError: error.message,
        updatedAt: new Date().toISOString(),
      });
    } else {
      this.update(id, {
        status: 'pending',
        attempts,
        lastError: error.message,
        retryAfter: nextRetryAfter(attempts),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  private update(id: string, patch: Partial<Job>): void {
    const job = this.jobs.get(id);
    if (!job) return;
    this.jobs.set(id, { ...job, ...patch });
  }

  private isTerminal(status: JobStatus): boolean {
    return status === 'completed' || status === 'dead';
  }
}
