import type { ScheduledTransferService } from './ScheduledTransferService';
import { recordSchedulerExecution } from '../metrics/index';

const DEFAULT_POLL_INTERVAL_MS = 1_000;

export interface SchedulerEngineOptions {
  pollIntervalMs?: number;
  now?: () => Date;
}

/**
 * Off-chain scheduler that polls for due transfers and executes them
 * through the existing relayer pipeline.
 *
 * Uses the ScheduledTransferService which acquires per-transfer distributed
 * leases (PgScheduledTransferStore) or in-process locks (ScheduledTransferStore)
 * to prevent double-execution across concurrent worker instances.
 *
 * Records scheduler_jobs_* Prometheus metrics for every execution tick —
 * successful, idle (zero due transfers), and failed alike — so that a
 * persistently failing or permanently idle scheduler is visible to monitoring
 * rather than indistinguishable from one that is simply not running.
 */
export class SchedulerEngine {
  private readonly service: ScheduledTransferService;
  private readonly pollIntervalMs: number;
  private readonly now: () => Date;
  private running = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Count of consecutive failed ticks. Distinct from the per-transfer
   * `consecutiveFailures` tracked by ScheduledTransferService: this counts
   * whole-tick failures (e.g. the store being unreachable), not failures of
   * an individual transfer.
   */
  private consecutiveFailures = 0;

  constructor(service: ScheduledTransferService, options: SchedulerEngineOptions = {}) {
    this.service = service;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.now = options.now ?? (() => new Date());
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.schedulePoll();
  }

  stop(): void {
    this.running = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Process due transfers immediately (useful in tests).
   *
   * Rethrows a failing tick so callers can assert on the error. The metric is
   * recorded either way; the polling loop swallows the rejection separately.
   */
  async tick(): Promise<number> {
    return this.runTick();
  }

  private async runTick(): Promise<number> {
    const before = this.now();

    try {
      const processed = await this.service.processDueTransfers(before);
      this.consecutiveFailures = 0;
      // Record on every successful tick, including idle ones. An idle tick is a
      // healthy scheduler with nothing due; omitting it made "working but idle"
      // and "not running at all" look identical on the dashboard.
      recordSchedulerExecution({
        outcome: 'success',
        lagMs: Date.now() - before.getTime(),
        consecutiveFailures: 0,
      });
      return processed;
    } catch (error) {
      this.consecutiveFailures += 1;
      recordSchedulerExecution({
        outcome: 'failed',
        lagMs: Date.now() - before.getTime(),
        consecutiveFailures: this.consecutiveFailures,
      });
      throw error;
    }
  }

  private schedulePoll(): void {
    if (!this.running) return;
    this.pollTimer = setTimeout(() => {
      // runTick() rethrows so that the public tick() surfaces errors. Here the
      // rejection is deliberately swallowed after being recorded as a failure
      // metric: an unhandled rejection would otherwise terminate the process
      // under Node's default --unhandled-rejections=throw, taking down the
      // relayer over a transient DB blip. The loop must keep polling.
      void this.runTick()
        .catch(() => undefined)
        .finally(() => this.schedulePoll());
    }, this.pollIntervalMs);
  }
}
