import { Button, cn } from '@ancore/ui-kit';
import type { ScheduleFrequency } from '@ancore/types';
import { CalendarClock } from 'lucide-react';
import {
  defaultScheduleStartAt,
  SCHEDULE_FREQUENCY_OPTIONS,
} from '@/services/scheduler-client';

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
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-cyan-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
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
              'h-11 rounded-xl text-[10px] font-black uppercase tracking-widest',
              timing === option
                ? 'bg-cyan-400 text-slate-950'
                : 'border-white/10 bg-transparent text-slate-400'
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
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Frequency
            </span>
            <select
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400/50"
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
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Start date & time
            </span>
            <input
              type="datetime-local"
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400/50"
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
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                End date (optional)
              </span>
              <input
                type="datetime-local"
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400/50"
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
