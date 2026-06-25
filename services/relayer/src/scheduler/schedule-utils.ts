import type { ScheduleFrequency } from './types';

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

  const next = new Date(from);

  switch (frequency) {
    case 'daily':
      next.setUTCDate(next.getUTCDate() + 1);
      break;
    case 'weekly':
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case 'monthly':
      next.setUTCMonth(next.getUTCMonth() + 1);
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
