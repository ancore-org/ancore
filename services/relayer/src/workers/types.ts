import type { Job, JobType } from '../queue/types';

/**
 * A handler registered for a specific job type.
 * Must resolve on success or throw on failure.
 */
export type JobHandler<T = unknown> = (job: Job<T>) => Promise<void>;

export interface WorkerOptions {
  /** Polling interval in milliseconds when the queue is empty (default: 500 ms) */
  pollIntervalMs?: number;
  /** Maximum concurrent jobs processed at once (default: 1) */
  concurrency?: number;
}

export interface WorkerStats {
  processed: number;
  succeeded: number;
  failed: number;
  deadLettered: number;
}

export type HandlerRegistry = Partial<Record<JobType, JobHandler>>;
