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

  /**
   * The tick currently in flight, if any (#1346).
   *
   * `stop()` clears the timer, which prevents the *next* tick, but a tick
   * already running is executing scheduled transfers — signing and submitting
   * real transactions. Shutting down without waiting for it kills a transfer
   * somewhere between "signed" and "confirmed", which for a money-moving
   * service is the one state you cannot reconcile from the outside.
   */
  private inFlightTick: Promise<unknown> | null = null;

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

  /** Whether a tick is currently executing. */
  get isTicking(): boolean {
    return this.inFlightTick !== null;
  }

  /**
   * Stop polling and wait for any tick already in flight to finish (#1346).
   *
   * Resolves `true` when the scheduler is fully idle, `false` when
   * `timeoutMs` elapsed first — the caller decides whether to keep waiting or
   * proceed with shutdown, rather than this hanging a deploy indefinitely.
   *
   * Safe to call when already stopped or never started: it resolves `true`
   * immediately.
   */
  async drain(timeoutMs: number): Promise<boolean> {
    this.stop();

    const pending = this.inFlightTick;
    if (!pending) return true;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
    });

    try {
      // The tick's own rejection is already recorded as a failure metric by
      // `runTick`; here it only matters that it finished.
      return await Promise.race([
        pending.then(
          () => true,
          () => true
        ),
        timedOut,
      ]);
    } finally {
      if (timer) clearTimeout(timer);
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
    const tick = this.executeTick(before);

    // Tracked so `drain` can await it. Cleared in `finally` rather than on
    // success, so a failing tick does not leave the scheduler looking busy
    // forever.
    this.inFlightTick = tick;
    try {
      return await tick;
    } finally {
      if (this.inFlightTick === tick) {
        this.inFlightTick = null;
      }
    }
  }

  private async executeTick(before: Date): Promise<number> {
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
