import type { ScheduleConfig } from '@/screens/Send/ScheduleControls';

export function validateSchedule(schedule?: ScheduleConfig): string | undefined {
  if (!schedule?.startAt) {
    return 'Schedule start time is required';
  }

  const startAt = new Date(schedule.startAt);
  if (Number.isNaN(startAt.getTime())) {
    return 'Invalid schedule start time';
  }

  if (startAt.getTime() < Date.now() - 60_000) {
    return 'Schedule must start in the future';
  }

  if (schedule.endAt) {
    const endAt = new Date(schedule.endAt);
    if (Number.isNaN(endAt.getTime()) || endAt.getTime() <= startAt.getTime()) {
      return 'End date must be after the start date';
    }
  }

  return undefined;
}
