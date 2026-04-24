/**
 * Job status lifecycle:
 *   pending → processing → completed
 *                       ↘ failed → (retry) → pending
 *                                → dead (max retries exceeded)
 */
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'dead';

export type JobType = 'relay_execute' | 'add_session_key' | 'revoke_session_key';

export interface Job<T = unknown> {
  /** Unique job identifier */
  id: string;
  /** Caller-supplied idempotency key — duplicate jobs with the same key are suppressed */
  idempotencyKey: string;
  type: JobType;
  payload: T;
  status: JobStatus;
  /** Number of attempts made so far */
  attempts: number;
  /** Maximum allowed attempts before moving to dead-letter */
  maxAttempts: number;
  /** ISO timestamp of when the job was created */
  createdAt: string;
  /** ISO timestamp of when the job was last updated */
  updatedAt: string;
  /** ISO timestamp after which the job may be retried (undefined = immediately eligible) */
  retryAfter?: string;
  /** Last error message recorded on failure */
  lastError?: string;
}

export interface EnqueueOptions {
  idempotencyKey: string;
  type: JobType;
  payload: unknown;
  /** Override default max attempts (default: 5) */
  maxAttempts?: number;
}

export interface DequeueResult<T = unknown> {
  job: Job<T>;
  /** Call to mark the job completed */
  ack: () => void;
  /** Call to mark the job failed and schedule a retry (or move to dead-letter) */
  nack: (error: Error) => void;
}
