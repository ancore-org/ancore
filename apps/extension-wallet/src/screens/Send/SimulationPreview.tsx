/**
 * SimulationPreview — shows the simulated transaction result and fee
 * before the user confirms a send.
 *
 * Renders three states:
 *  - loading  — simulation is in progress
 *  - error    — simulation failed (shows reason, blocks confirm)
 *  - success  — shows simulated fee, resource limits, auth, and footprint
 */

import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { SorobanResourceLimits } from '@/services/simulation-service';

export type SimulationState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'success';
      simulatedFee: string;
      outcome: string;
      authEntries?: string[];
      footprint?: string;
      resourceLimits?: SorobanResourceLimits;
    };

interface SimulationPreviewProps {
  simulation: SimulationState;
}

function truncateValue(value: string, maxLength = 24): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}…`;
}

export function SimulationPreview({ simulation }: SimulationPreviewProps) {
  if (simulation.status === 'loading') {
    return (
      <div
        role="status"
        aria-label="Simulating transaction"
        data-testid="simulation-loading"
        className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-400"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400 shrink-0" aria-hidden="true" />
        <span>Simulating transaction…</span>
      </div>
    );
  }

  if (simulation.status === 'error') {
    return (
      <div
        role="alert"
        data-testid="simulation-error"
        className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300"
      >
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <div className="space-y-0.5">
          <span className="block font-black uppercase tracking-widest text-[10px] text-amber-400">
            Simulation Failed
          </span>
          <span className="leading-relaxed">{simulation.message}</span>
        </div>
      </div>
    );
  }

  const authEntries = simulation.authEntries ?? [];
  const hasAuthEntries = authEntries.length > 0;
  const hasFootprint = Boolean(simulation.footprint);

  return (
    <div
      data-testid="simulation-success"
      className="space-y-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3"
    >
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
          Simulation Passed
        </span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-slate-500 uppercase tracking-widest font-bold text-[10px]">
          Simulated Fee
        </span>
        <span className="font-mono text-slate-300" data-testid="simulated-fee">
          {simulation.simulatedFee} XLM
        </span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-slate-500 uppercase tracking-widest font-bold text-[10px]">
          Expected Outcome
        </span>
        <span className="font-mono text-emerald-300 capitalize">{simulation.outcome}</span>
      </div>
      {simulation.resourceLimits && simulation.resourceLimits.cpuInsn > 0 && (
        <div className="flex justify-between text-xs">
          <span className="text-slate-500 uppercase tracking-widest font-bold text-[10px]">
            CPU Instructions
          </span>
          <span className="font-mono text-slate-300">{simulation.resourceLimits.cpuInsn}</span>
        </div>
      )}
      {hasAuthEntries && (
        <div className="space-y-1 text-xs" data-testid="simulation-auth-entries">
          <span className="text-slate-500 uppercase tracking-widest font-bold text-[10px]">
            Auth Entries ({authEntries.length})
          </span>
          {authEntries.map((entry, index) => (
            <div
              key={`${entry.slice(0, 8)}-${index}`}
              className="font-mono text-[10px] text-slate-400 break-all"
            >
              {truncateValue(entry, 48)}
            </div>
          ))}
        </div>
      )}
      {hasFootprint && (
        <div className="space-y-1 text-xs" data-testid="simulation-footprint">
          <span className="text-slate-500 uppercase tracking-widest font-bold text-[10px]">
            Footprint
          </span>
          <div className="font-mono text-[10px] text-slate-400 break-all">
            {truncateValue(simulation.footprint ?? '', 48)}
          </div>
        </div>
      )}
    </div>
  );
}
