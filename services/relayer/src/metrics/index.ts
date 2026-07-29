/**
 * Prometheus metrics for the Relayer service.
 *
 * Exposes:
 *  - relay_request_total                 — counter of relay requests by route and status
 *  - relay_request_duration_seconds      — histogram of /relay/* handler latency
 *  - relay_errors_total                  — counter of relay errors by error code
 *  - relay_validation_failures_total     — counter of validation failures by code
 *  - relay_mock_mode                     — gauge: 1 if mock submission is enabled, 0 otherwise
 *  - relay_submit_duration_seconds       — histogram of Stellar submit latency
 *
 * Issue #675
 */

import { trace, context as otelContext } from '@opentelemetry/api';

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
// Histogram — base class
// ---------------------------------------------------------------------------

class RelayHistogram {
  private readonly buckets: Map<number, number>;
  private infCount = 0;
  private sum = 0;
  private count = 0;

  constructor(private readonly bucketDefs: number[]) {
    this.buckets = new Map(bucketDefs.map((le) => [le, 0]));
  }

  observe(durationSeconds: number): void {
    this.sum += durationSeconds;
    this.count += 1;

    for (const le of this.bucketDefs) {
      if (durationSeconds <= le) {
        this.buckets.set(le, (this.buckets.get(le) ?? 0) + 1);
        break;
      }
    }
    this.infCount += 1;
  }

  snapshot(): HistogramSnapshot {
    let cumulative = 0;
    const buckets: HistogramBucket[] = [];
    for (const le of this.bucketDefs) {
      cumulative += this.buckets.get(le) ?? 0;
      buckets.push({ le, count: cumulative });
    }
    buckets.push({ le: '+Inf', count: this.infCount });
    return { buckets, sum: this.sum, count: this.count };
  }

  reset(): void {
    for (const le of this.bucketDefs) this.buckets.set(le, 0);
    this.infCount = 0;
    this.sum = 0;
    this.count = 0;
  }
}

// ---------------------------------------------------------------------------
// Counter — base class
// ---------------------------------------------------------------------------

class RelayCounter {
  protected readonly counts: Map<string, number> = new Map();

  increment(label: string): void {
    this.counts.set(label, (this.counts.get(label) ?? 0) + 1);
  }

  snapshot(): CounterSnapshot {
    return Object.fromEntries(this.counts);
  }

  reset(): void {
    this.counts.clear();
  }
}

// ---------------------------------------------------------------------------
// Gauge
// ---------------------------------------------------------------------------

class RelayGauge {
  private value = 0;

  set(v: number): void {
    this.value = v;
  }

  get(): number {
    return this.value;
  }
}

// ---------------------------------------------------------------------------
// Singleton registry
// ---------------------------------------------------------------------------

export const relayRequestTotal = new RelayCounter();
export const relayLatency = new RelayHistogram([
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
]);
export const relayErrors = new RelayCounter();
export const relayValidationFailures = new RelayCounter();
export const relayMockMode = new RelayGauge();
export const relaySubmitLatency = new RelayHistogram([
  0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 20,
]);

// ---------------------------------------------------------------------------
// Helpers for recording with OTEL metric instruments (future migration)
// ---------------------------------------------------------------------------

export function getTracer(): ReturnType<typeof trace.getTracer> {
  return trace.getTracer('ancore-relayer-metrics');
}

export function recordSubmitLatency(durationSeconds: number): void {
  relaySubmitLatency.observe(durationSeconds);
  const span = trace.getSpan(otelContext.active());
  if (span) {
    span.setAttribute('submit.latency_ms', Math.round(durationSeconds * 1000));
  }
}

// ---------------------------------------------------------------------------
// Prometheus text format serialiser
// ---------------------------------------------------------------------------

function renderHistogram(name: string, help: string, h: RelayHistogram): string[] {
  const snap = h.snapshot();
  const lines: string[] = [];
  lines.push(`# HELP ${name} ${help}`);
  lines.push(`# TYPE ${name} histogram`);
  for (const bucket of snap.buckets) {
    lines.push(`${name}_bucket{le="${bucket.le}"} ${bucket.count}`);
  }
  lines.push(`${name}_sum ${snap.sum}`);
  lines.push(`${name}_count ${snap.count}`);
  return lines;
}

function renderCounter(name: string, help: string, c: RelayCounter, label: string): string[] {
  const snap = c.snapshot();
  const lines: string[] = [`# HELP ${name} ${help}`, `# TYPE ${name} counter`];
  for (const [key, count] of Object.entries(snap)) {
    lines.push(`${name}{${label}="${key}"} ${count}`);
  }
  if (Object.keys(snap).length === 0) {
    lines.push(`${name}{${label}=""} 0`);
  }
  return lines;
}

function renderCounterNoLabel(name: string, help: string, c: RelayCounter): string[] {
  const snap = c.snapshot();
  const lines: string[] = [`# HELP ${name} ${help}`, `# TYPE ${name} counter`];
  for (const [key, count] of Object.entries(snap)) {
    lines.push(`${name}{route="${key}"} ${count}`);
  }
  if (Object.keys(snap).length === 0) {
    lines.push(`${name}{route=""} 0`);
  }
  return lines;
}

export function renderPrometheusMetrics(): string {
  const lines: string[] = [];

  lines.push(
    ...renderHistogram(
      'relay_request_duration_seconds',
      'Histogram of /relay/* handler latency in seconds',
      relayLatency
    )
  );

  lines.push(
    ...renderCounter(
      'relay_errors_total',
      'Counter of relay errors by error code',
      relayErrors,
      'code'
    )
  );

  lines.push(
    ...renderCounter(
      'relay_validation_failures_total',
      'Counter of relay validation failures by failure code',
      relayValidationFailures,
      'code'
    )
  );

  lines.push(
    ...renderCounterNoLabel(
      'relay_request_total',
      'Counter of relay requests by route',
      relayRequestTotal
    )
  );

  lines.push(
    '# HELP relay_mock_mode Gauge indicating mock submission mode is enabled (1) or disabled (0)',
    '# TYPE relay_mock_mode gauge',
    `relay_mock_mode ${relayMockMode.get()}`
  );

  lines.push(
    ...renderHistogram(
      'relay_submit_duration_seconds',
      'Histogram of Stellar submit operation latency in seconds',
      relaySubmitLatency
    )
  );

  return lines.join('\n') + '\n';
}
