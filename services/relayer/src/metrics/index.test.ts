/**
 * Tests for Prometheus metrics — relay_request_duration_seconds and relay_errors_total.
 * Issue #675
 */

import { relayLatency, relayErrors, renderPrometheusMetrics } from './index';

beforeEach(() => {
  relayLatency.reset();
  relayErrors.reset();
});

describe('RelayLatencyHistogram', () => {
  it('increments count on observe', () => {
    relayLatency.observe(0.05);
    const snap = relayLatency.snapshot();
    expect(snap.count).toBe(1);
  });

  it('accumulates sum', () => {
    relayLatency.observe(0.1);
    relayLatency.observe(0.2);
    const snap = relayLatency.snapshot();
    expect(snap.sum).toBeCloseTo(0.3);
  });

  it('places observation in correct bucket', () => {
    relayLatency.observe(0.05); // should land in ≤0.05 bucket
    const snap = relayLatency.snapshot();
    const bucket = snap.buckets.find((b) => b.le === 0.05);
    expect(bucket?.count).toBeGreaterThanOrEqual(1);
  });

  it('+Inf bucket always equals total count', () => {
    relayLatency.observe(0.001);
    relayLatency.observe(100); // beyond all finite buckets
    const snap = relayLatency.snapshot();
    const inf = snap.buckets.find((b) => b.le === '+Inf');
    expect(inf?.count).toBe(snap.count);
  });

  it('buckets are cumulative', () => {
    relayLatency.observe(0.005);
    relayLatency.observe(0.1);
    const snap = relayLatency.snapshot();
    let prev = 0;
    for (const b of snap.buckets) {
      expect(b.count).toBeGreaterThanOrEqual(prev);
      prev = b.count;
    }
  });

  it('reset clears all state', () => {
    relayLatency.observe(1);
    relayLatency.reset();
    const snap = relayLatency.snapshot();
    expect(snap.count).toBe(0);
    expect(snap.sum).toBe(0);
  });
});

describe('RelayErrorCounter', () => {
  it('increments a new error code', () => {
    relayErrors.increment('INVALID_SIGNATURE');
    expect(relayErrors.snapshot()['INVALID_SIGNATURE']).toBe(1);
  });

  it('accumulates multiple increments for the same code', () => {
    relayErrors.increment('NONCE_REPLAY');
    relayErrors.increment('NONCE_REPLAY');
    expect(relayErrors.snapshot()['NONCE_REPLAY']).toBe(2);
  });

  it('tracks multiple distinct error codes independently', () => {
    relayErrors.increment('INVALID_SIGNATURE');
    relayErrors.increment('SESSION_KEY_EXPIRED');
    const snap = relayErrors.snapshot();
    expect(snap['INVALID_SIGNATURE']).toBe(1);
    expect(snap['SESSION_KEY_EXPIRED']).toBe(1);
  });

  it('reset clears all counts', () => {
    relayErrors.increment('INTERNAL_ERROR');
    relayErrors.reset();
    expect(relayErrors.snapshot()).toEqual({});
  });
});

describe('renderPrometheusMetrics', () => {
  it('includes histogram HELP and TYPE lines', () => {
    const output = renderPrometheusMetrics();
    expect(output).toContain('# HELP relay_request_duration_seconds');
    expect(output).toContain('# TYPE relay_request_duration_seconds histogram');
  });

  it('includes counter HELP and TYPE lines', () => {
    const output = renderPrometheusMetrics();
    expect(output).toContain('# HELP relay_errors_total');
    expect(output).toContain('# TYPE relay_errors_total counter');
  });

  it('renders histogram bucket lines', () => {
    relayLatency.observe(0.05);
    const output = renderPrometheusMetrics();
    expect(output).toMatch(/relay_request_duration_seconds_bucket\{le="0\.05"\}/);
    expect(output).toContain('relay_request_duration_seconds_bucket{le="+Inf"}');
  });

  it('renders _sum and _count lines', () => {
    relayLatency.observe(0.2);
    const output = renderPrometheusMetrics();
    expect(output).toContain('relay_request_duration_seconds_sum');
    expect(output).toContain('relay_request_duration_seconds_count 1');
  });

  it('renders error counter with label', () => {
    relayErrors.increment('GAS_LIMIT_EXCEEDED');
    const output = renderPrometheusMetrics();
    expect(output).toContain('relay_errors_total{code="GAS_LIMIT_EXCEEDED"} 1');
  });

  it('emits zero-value counter line when no errors recorded', () => {
    const output = renderPrometheusMetrics();
    expect(output).toContain('relay_errors_total{code=""} 0');
  });

  it('output ends with a newline', () => {
    const output = renderPrometheusMetrics();
    expect(output.endsWith('\n')).toBe(true);
  });
});
