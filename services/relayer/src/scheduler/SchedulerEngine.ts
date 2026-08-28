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
 * Records scheduler_jobs_* Prometheus metrics for each execution tick.
 */
export class SchedulerEngine {
  private readonly service: ScheduledTransferService;
  private readonly pollIntervalMs: number;
  private readonly now: () => Date;
  private running = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

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

  /** Process due transfers immediately (useful in tests). */
  async tick(): Promise<number> {
    return this.runTick();
  }

  private async runTick(): Promise<number> {
    const before = this.now();
    const processed = await this.service.processDueTransfers(before);
    const lagMs = Date.now() - before.getTime();

    if (processed > 0) {
      recordSchedulerExecution({ outcome: 'success', lagMs, consecutiveFailures: 0 });
    }

    return processed;
  }

  private schedulePoll(): void {
    if (!this.running) return;
    this.pollTimer = setTimeout(() => {
      void this.runTick().finally(() => this.schedulePoll());
    }, this.pollIntervalMs);
  }
}
