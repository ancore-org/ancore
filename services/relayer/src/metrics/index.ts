/**
 * Prometheus metrics for the Relayer service.
 *
 * Exposes:
 *  - relay_request_duration_seconds  — histogram of /relay/* handler latency
 *  - relay_errors_total              — counter of relay errors by error code
 *
 * Issue #675
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HistogramBucket {
  le: number | '+Inf';
  count: number;
}

interface HistogramSnapshot {
  buckets: HistogramBucket[];
  sum: number;
  count: number;
}

interface CounterSnapshot {
  [label: string]: number;
}

// ---------------------------------------------------------------------------
// Histogram — relay_request_duration_seconds
// ---------------------------------------------------------------------------

/** Upper bounds in seconds for latency buckets (Prometheus convention). */
const LATENCY_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

class RelayLatencyHistogram {
  private readonly buckets: Map<number, number> = new Map(LATENCY_BUCKETS.map((le) => [le, 0]));
  private infCount = 0;
  private sum = 0;
  private count = 0;

  observe(durationSeconds: number): void {
    this.sum += durationSeconds;
    this.count += 1;

    for (const le of LATENCY_BUCKETS) {
      if (durationSeconds <= le) {
        this.buckets.set(le, (this.buckets.get(le) ?? 0) + 1);
        break;
      }
    }
    // +Inf bucket always increments
    this.infCount += 1;
  }

  snapshot(): HistogramSnapshot {
    // Cumulative counts (Prometheus histogram semantics)
    let cumulative = 0;
    const buckets: HistogramBucket[] = [];
    for (const le of LATENCY_BUCKETS) {
      cumulative += this.buckets.get(le) ?? 0;
      buckets.push({ le, count: cumulative });
    }
    buckets.push({ le: '+Inf', count: this.infCount });
    return { buckets, sum: this.sum, count: this.count };
  }

  reset(): void {
    for (const le of LATENCY_BUCKETS) this.buckets.set(le, 0);
    this.infCount = 0;
    this.sum = 0;
    this.count = 0;
  }
}

// ---------------------------------------------------------------------------
// Counter — relay_errors_total
// ---------------------------------------------------------------------------

class RelayErrorCounter {
  private readonly counts: Map<string, number> = new Map();

  increment(errorCode: string): void {
    this.counts.set(errorCode, (this.counts.get(errorCode) ?? 0) + 1);
  }

  snapshot(): CounterSnapshot {
    return Object.fromEntries(this.counts);
  }

  reset(): void {
    this.counts.clear();
  }
}

// ---------------------------------------------------------------------------
// Singleton registry
// ---------------------------------------------------------------------------

export const relayLatency = new RelayLatencyHistogram();
export const relayErrors = new RelayErrorCounter();

// ── Scheduler metrics ─────────────────────────────────────────────────────────

class SimpleCounter {
  private value = 0;
  inc(by = 1): void {
    this.value += by;
  }
  get(): number {
    return this.value;
  }
  reset(): void {
    this.value = 0;
  }
}

class SimpleGauge {
  private value = 0;
  set(v: number): void {
    this.value = v;
  }
  inc(by = 1): void {
    this.value += by;
  }
  dec(by = 1): void {
    this.value -= by;
  }
  get(): number {
    return this.value;
  }
}

/**
 * scheduler_jobs_executed_total — count of scheduled transfer executions attempted.
 * scheduler_jobs_succeeded_total — count of successful executions.
 * scheduler_jobs_failed_total — count of failed executions.
 * scheduler_job_lag_seconds — seconds between next_run_at and actual execution time.
 * scheduler_consecutive_failures_total — times a transfer accumulated ≥2 consecutive failures.
 */
export const schedulerJobsExecuted = new SimpleCounter();
export const schedulerJobsSucceeded = new SimpleCounter();
export const schedulerJobsFailed = new SimpleCounter();
export const schedulerConsecutiveFailures = new SimpleCounter();

/** Gauge: sum of lag seconds across all executions in this process lifetime. */
export const schedulerJobLagSecondsTotal = new SimpleGauge();

export function recordSchedulerExecution(opts: {
  outcome: 'success' | 'failed';
  lagMs: number;
  consecutiveFailures: number;
}): void {
  schedulerJobsExecuted.inc();
  if (opts.outcome === 'success') {
    schedulerJobsSucceeded.inc();
  } else {
    schedulerJobsFailed.inc();
    if (opts.consecutiveFailures >= 2) {
      schedulerConsecutiveFailures.inc();
    }
  }
  schedulerJobLagSecondsTotal.inc(opts.lagMs / 1000);
}

// ---------------------------------------------------------------------------
// Prometheus text format serialiser
// ---------------------------------------------------------------------------

/**
 * Serialises the current metric state to Prometheus text exposition format.
 * Suitable for serving on GET /metrics.
 */
export function renderPrometheusMetrics(): string {
  const lines: string[] = [];

  // ── relay_request_duration_seconds ──────────────────────────────────────
  lines.push(
    '# HELP relay_request_duration_seconds Histogram of /relay/* handler latency in seconds'
  );
  lines.push('# TYPE relay_request_duration_seconds histogram');
  const latencySnap = relayLatency.snapshot();
  for (const bucket of latencySnap.buckets) {
    lines.push(`relay_request_duration_seconds_bucket{le="${bucket.le}"} ${bucket.count}`);
  }
  lines.push(`relay_request_duration_seconds_sum ${latencySnap.sum}`);
  lines.push(`relay_request_duration_seconds_count ${latencySnap.count}`);

  // ── relay_errors_total ───────────────────────────────────────────────────
  lines.push('# HELP relay_errors_total Counter of relay errors by error code');
  lines.push('# TYPE relay_errors_total counter');
  const errorSnap = relayErrors.snapshot();
  for (const [code, count] of Object.entries(errorSnap)) {
    lines.push(`relay_errors_total{code="${code}"} ${count}`);
  }
  // Emit a zero-value line when no errors have been recorded so the metric
  // always appears in the output (avoids "no data" gaps in dashboards).
  if (Object.keys(errorSnap).length === 0) {
    lines.push('relay_errors_total{code=""} 0');
  }

  // ── scheduler metrics ──────────────────────────────────────────────────────
  lines.push('# HELP scheduler_jobs_executed_total Total scheduled transfer executions attempted');
  lines.push('# TYPE scheduler_jobs_executed_total counter');
  lines.push(`scheduler_jobs_executed_total ${schedulerJobsExecuted.get()}`);

  lines.push('# HELP scheduler_jobs_succeeded_total Successful scheduled transfer executions');
  lines.push('# TYPE scheduler_jobs_succeeded_total counter');
  lines.push(`scheduler_jobs_succeeded_total ${schedulerJobsSucceeded.get()}`);

  lines.push('# HELP scheduler_jobs_failed_total Failed scheduled transfer executions');
  lines.push('# TYPE scheduler_jobs_failed_total counter');
  lines.push(`scheduler_jobs_failed_total ${schedulerJobsFailed.get()}`);

  lines.push(
    '# HELP scheduler_consecutive_failures_total Transfers that accumulated ≥2 consecutive failures'
  );
  lines.push('# TYPE scheduler_consecutive_failures_total counter');
  lines.push(`scheduler_consecutive_failures_total ${schedulerConsecutiveFailures.get()}`);

  lines.push(
    '# HELP scheduler_job_lag_seconds_total Cumulative seconds between next_run_at and actual execution'
  );
  lines.push('# TYPE scheduler_job_lag_seconds_total counter');
  lines.push(`scheduler_job_lag_seconds_total ${schedulerJobLagSecondsTotal.get().toFixed(3)}`);

  return lines.join('\n') + '\n';
}
