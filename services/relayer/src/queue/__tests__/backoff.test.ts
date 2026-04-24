import { computeBackoffMs, nextRetryAfter } from '../backoff';

describe('computeBackoffMs', () => {
  it('returns 0 for attempt 0 with base 0', () => {
    expect(computeBackoffMs(0, 0)).toBe(0);
  });

  it('never exceeds the cap', () => {
    for (let i = 0; i < 20; i++) {
      expect(computeBackoffMs(i, 1_000, 60_000)).toBeLessThanOrEqual(60_000);
    }
  });

  it('returns a non-negative value', () => {
    for (let i = 0; i < 10; i++) {
      expect(computeBackoffMs(i)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('nextRetryAfter', () => {
  it('returns an ISO string in the future', () => {
    const now = new Date();
    const result = nextRetryAfter(1, now);
    expect(new Date(result).getTime()).toBeGreaterThanOrEqual(now.getTime());
  });
});
