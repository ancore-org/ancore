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
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000);
    // datetime-local expects local time without a timezone suffix; toISOString() emits UTC.
    const offsetMs = future.getTimezoneOffset() * 60 * 1000;
    const startAt = new Date(future.getTime() - offsetMs).toISOString().slice(0, 16);

    expect(
      validateSchedule({
        frequency: 'weekly',
        startAt,
      })
    ).toBeUndefined();
  });
});
