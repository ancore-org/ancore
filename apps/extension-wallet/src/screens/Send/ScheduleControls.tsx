import { Button, cn } from '@ancore/ui-kit';
import type { ScheduleFrequency } from '@ancore/types';
import { CalendarClock } from 'lucide-react';
import { defaultScheduleStartAt, SCHEDULE_FREQUENCY_OPTIONS } from '@/services/scheduler-client';

export type TransferTiming = 'immediate' | 'scheduled';

export interface ScheduleConfig {
  frequency: ScheduleFrequency;
  startAt: string;
  endAt?: string;
}

interface ScheduleControlsProps {
  timing: TransferTiming;
  schedule: ScheduleConfig;
  onTimingChange: (timing: TransferTiming) => void;
  onScheduleChange: (schedule: ScheduleConfig) => void;
  error?: string;
}

export function ScheduleControls({
  timing,
  schedule,
  onTimingChange,
  onScheduleChange,
  error,
}: ScheduleControlsProps) {
  return (
    <div className="space-y-4 rounded-[18px] border border-border/70 bg-card p-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-primary" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Transfer Timing
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(['immediate', 'scheduled'] as TransferTiming[]).map((option) => (
          <Button
            key={option}
            type="button"
            variant={timing === option ? 'default' : 'outline'}
            className={cn(
              'h-11 rounded-xl text-[10px] font-semibold uppercase tracking-[0.15em]',
              timing === option
                ? 'bg-white text-black hover:bg-white/90'
                : 'border-border bg-transparent text-muted-foreground hover:bg-accent'
            )}
            onClick={() => onTimingChange(option)}
          >
            {option === 'immediate' ? 'Send now' : 'Schedule'}
          </Button>
        ))}
      </div>

      {timing === 'scheduled' && (
        <div className="space-y-3">
          <label className="block space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Frequency
            </span>
            <select
              className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:border-primary/60"
              value={schedule.frequency}
              onChange={(event) =>
                onScheduleChange({
                  ...schedule,
                  frequency: event.target.value as ScheduleFrequency,
                })
              }
            >
              {SCHEDULE_FREQUENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Start date & time
            </span>
            <input
              type="datetime-local"
              className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:border-primary/60"
              value={schedule.startAt}
              onChange={(event) =>
                onScheduleChange({
                  ...schedule,
                  startAt: event.target.value,
                })
              }
            />
          </label>

          {schedule.frequency !== 'once' && (
            <label className="block space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                End date (optional)
              </span>
              <input
                type="datetime-local"
                className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:border-primary/60"
                value={schedule.endAt ?? ''}
                onChange={(event) =>
                  onScheduleChange({
                    ...schedule,
                    endAt: event.target.value || undefined,
                  })
                }
              />
            </label>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export function createDefaultScheduleConfig(): ScheduleConfig {
  return {
    frequency: 'once',
    startAt: defaultScheduleStartAt(),
  };
}
