import type { ScheduleFrequency } from './types';

/**
 * Number of days in the given UTC month (1-indexed month, matching the
 * `Date` constructor's day-0-of-next-month trick).
 */
function daysInUTCMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Advance `date` by one calendar month, clamping the day-of-month to the
 * target month's last valid day.
 *
 * `Date#setUTCMonth` overflows into a later month when the current
 * day-of-month doesn't exist in the target month — e.g. Jan 31 plus one
 * month rolls forward to Mar 3 instead of landing on Feb 28 (or Feb 29 in
 * a leap year). Clamping the day beforehand keeps the recurrence anchored
 * to the intended month.
 */
function addOneUTCMonthClamped(date: Date): Date {
  const next = new Date(date);
  const originalDay = next.getUTCDate();
  const targetYear = next.getUTCFullYear();
  const targetMonth = next.getUTCMonth() + 1;
  const targetMonthLastDay = daysInUTCMonth(targetYear, targetMonth);

  next.setUTCDate(1);
  next.setUTCMonth(targetMonth);
  next.setUTCDate(Math.min(originalDay, targetMonthLastDay));

  return next;
}

/**
 * Compute the next run time after a successful execution.
 * Returns null for one-time schedules or when recurrence has ended.
 */
export function computeNextRunAt(
  from: Date,
  frequency: ScheduleFrequency,
  endAt?: Date
): Date | null {
  if (frequency === 'once') {
    return null;
  }

  let next: Date;

  switch (frequency) {
    case 'daily':
      next = new Date(from);
      next.setUTCDate(next.getUTCDate() + 1);
      break;
    case 'weekly':
      next = new Date(from);
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case 'monthly':
      next = addOneUTCMonthClamped(from);
      break;
    default:
      return null;
  }

  if (endAt && next.getTime() > endAt.getTime()) {
    return null;
  }

  return next;
}

export function isDue(nextRunAt: string, now: Date = new Date()): boolean {
  return new Date(nextRunAt).getTime() <= now.getTime();
}

export function formatFrequencyLabel(frequency: ScheduleFrequency): string {
  switch (frequency) {
    case 'once':
      return 'One-time';
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    default:
      return frequency;
  }
}
