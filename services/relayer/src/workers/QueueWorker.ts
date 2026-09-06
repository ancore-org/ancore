import type { JobQueueContract } from '../queue/types';
import type { HandlerRegistry, WorkerOptions, WorkerStats } from './types';

const DEFAULT_POLL_INTERVAL_MS = 500;
const DEFAULT_CONCURRENCY = 1;

/**
 * Polls a `JobQueue` (in-memory or Postgres-backed) and dispatches jobs to registered handlers.
 *
 * Usage:
 * ```ts
 * const worker = new QueueWorker(queue, { relay_execute: myHandler });
 * worker.start();
 * // ...
 * await worker.stop();
 * ```
 */
export class QueueWorker {
  private readonly queue: JobQueueContract;
  private readonly handlers: HandlerRegistry;
  private readonly pollIntervalMs: number;
  private readonly concurrency: number;

  private running = false;
  private activeJobs = 0;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  readonly stats: WorkerStats = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    deadLettered: 0,
  };

  constructor(queue: JobQueueContract, handlers: HandlerRegistry, options: WorkerOptions = {}) {
    this.queue = queue;
    this.handlers = handlers;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  start(): void {
    if (this.running) return;
    this.running = true;
    this.schedulePoll();
  }

  /**
   * Gracefully stop the worker.
   *
   * Waits for in-flight jobs to finish before resolving. `timeoutMs` bounds
   * that wait (#1346): without one, a handler that never settles keeps the
   * process alive until the orchestrator's SIGKILL, turning a clean drain into
   * a hard kill of everything else that was still shutting down properly.
   * Resolves either way — the caller cannot do anything useful with a
   * rejection here, and losing the rest of the shutdown sequence to an
   * exception would be worse than proceeding.
   */
  stop(timeoutMs?: number): Promise<void> {
    this.running = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    return this.waitForIdle(timeoutMs);
  }

  /** Number of jobs currently being handled. */
  get inFlight(): number {
    return this.activeJobs;
  }

  // ── Polling ────────────────────────────────────────────────────────────────

  private schedulePoll(): void {
    if (!this.running) return;
    this.pollTimer = setTimeout(() => this.poll(), this.pollIntervalMs);
  }

  private async poll(): Promise<void> {
    while (this.running && this.activeJobs < this.concurrency) {
      const result = await this.queue.dequeue();
      if (!result) break;

      this.activeJobs++;
      this.stats.processed++;

      const { job, ack, nack } = result;
      const handler = this.handlers[job.type];

      const finish = async (): Promise<void> => {
        try {
          if (!handler) {
            throw new Error(`No handler registered for job type "${job.type}"`);
          }
          await handler(job);
          await ack();
          this.stats.succeeded++;
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          await nack(error);
          this.stats.failed++;

          // Check if the job was moved to dead-letter after nack
          const updated = await this.queue.getById(job.id);
          if (updated?.status === 'dead') {
            this.stats.deadLettered++;
          }
        } finally {
          this.activeJobs--;
        }
      };

      // Fire-and-forget; concurrency is tracked via activeJobs counter
      void finish();
    }

    this.schedulePoll();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private waitForIdle(timeoutMs?: number): Promise<void> {
    return new Promise((resolve) => {
      const deadline = timeoutMs === undefined ? undefined : Date.now() + timeoutMs;

      const check = (): void => {
        if (this.activeJobs === 0) {
          resolve();
          return;
        }
        if (deadline !== undefined && Date.now() >= deadline) {
          resolve();
          return;
        }
        setTimeout(check, 10);
      };

      check();
    });
  }
}
