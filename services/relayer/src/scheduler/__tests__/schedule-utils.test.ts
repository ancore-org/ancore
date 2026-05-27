import { computeNextRunAt, formatFrequencyLabel, isDue } from '../schedule-utils';

describe('schedule-utils', () => {
  it('computes next daily run', () => {
    const from = new Date('2026-05-27T12:00:00.000Z');
    const next = computeNextRunAt(from, 'daily');
    expect(next?.toISOString()).toBe('2026-05-28T12:00:00.000Z');
  });

  it('returns null for one-time schedules', () => {
    const from = new Date('2026-05-27T12:00:00.000Z');
    expect(computeNextRunAt(from, 'once')).toBeNull();
  });

  it('respects endAt for recurring schedules', () => {
    const from = new Date('2026-05-27T12:00:00.000Z');
    const endAt = new Date('2026-05-28T00:00:00.000Z');
    expect(computeNextRunAt(from, 'daily', endAt)).toBeNull();
  });

  it('detects due schedules', () => {
    expect(isDue('2026-01-01T00:00:00.000Z', new Date('2026-05-27T00:00:00.000Z'))).toBe(true);
    expect(isDue('2099-01-01T00:00:00.000Z', new Date('2026-05-27T00:00:00.000Z'))).toBe(false);
  });

  it('formats frequency labels', () => {
    expect(formatFrequencyLabel('monthly')).toBe('Monthly');
  });
});
