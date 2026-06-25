import { describe, expect, it } from 'vitest';
import { validateSchedule } from '@/utils/schedule-validation';

describe('schedule-validation', () => {
  it('rejects invalid end dates', () => {
    expect(
      validateSchedule({
        frequency: 'daily',
        startAt: '2099-05-27T12:00',
        endAt: '2099-05-27T10:00',
      })
    ).toBe('End date must be after the start date');
  });
});
