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

  describe('monthly recurrence day clamping', () => {
    it('clamps Jan 31 to Feb 28 in a non-leap year instead of overflowing to March', () => {
      const from = new Date('2025-01-31T12:00:00.000Z');
      const next = computeNextRunAt(from, 'monthly');
      expect(next?.toISOString()).toBe('2025-02-28T12:00:00.000Z');
    });

    it('clamps Jan 31 to Feb 29 in a leap year', () => {
      const from = new Date('2028-01-31T12:00:00.000Z');
      const next = computeNextRunAt(from, 'monthly');
      expect(next?.toISOString()).toBe('2028-02-29T12:00:00.000Z');
    });

    it('clamps a 31st-of-the-month schedule to the 30th for 30-day months', () => {
      const from = new Date('2026-05-31T12:00:00.000Z');
      const next = computeNextRunAt(from, 'monthly');
      expect(next?.toISOString()).toBe('2026-06-30T12:00:00.000Z');
    });

    it('does not clamp when the day-of-month exists in the next month', () => {
      const from = new Date('2026-01-15T12:00:00.000Z');
      const next = computeNextRunAt(from, 'monthly');
      expect(next?.toISOString()).toBe('2026-02-15T12:00:00.000Z');
    });


    it('clamps March 31 to April 30', () => {
      const from = new Date('2026-03-31T12:00:00.000Z');
      const next = computeNextRunAt(from, 'monthly');
      expect(next?.toISOString()).toBe('2026-04-30T12:00:00.000Z');
    });

    it('preserves the UTC time across a leap-day month boundary', () => {
      const from = new Date('2028-01-31T23:45:12.345Z');
      const next = computeNextRunAt(from, 'monthly');
      expect(next?.toISOString()).toBe('2028-02-29T23:45:12.345Z');
    });

    it('does not mutate the original date when clamping a month end', () => {
      const from = new Date('2025-01-31T12:00:00.000Z');
      computeNextRunAt(from, 'monthly');
      expect(from.toISOString()).toBe('2025-01-31T12:00:00.000Z');
    });

    it('returns null when a clamped monthly run would exceed endAt', () => {
      const from = new Date('2025-01-31T12:00:00.000Z');
      const endAt = new Date('2025-02-28T11:59:59.999Z');
      expect(computeNextRunAt(from, 'monthly', endAt)).toBeNull();
    });

    it('rolls over the year correctly for a December run', () => {
      const from = new Date('2026-12-31T12:00:00.000Z');
      const next = computeNextRunAt(from, 'monthly');
      expect(next?.toISOString()).toBe('2027-01-31T12:00:00.000Z');
    });
  });
});
