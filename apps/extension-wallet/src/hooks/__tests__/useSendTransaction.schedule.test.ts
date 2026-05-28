import { describe, expect, it } from 'vitest';
import { validateSchedule } from '@/utils/schedule-validation';

describe('validateSchedule', () => {
  it('requires a future start time', () => {
    expect(validateSchedule(undefined)).toBe('Schedule start time is required');
    expect(
      validateSchedule({
        frequency: 'once',
        startAt: '2020-01-01T10:00',
      })
    ).toBe('Schedule must start in the future');
  });

  it('accepts a valid schedule', () => {
    const startAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16);
    expect(
      validateSchedule({
        frequency: 'weekly',
        startAt,
      })
    ).toBeUndefined();
  });
});
