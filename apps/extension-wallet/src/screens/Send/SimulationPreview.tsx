/**
 * SimulationPreview — shows the simulated transaction result and fee
 * before the user confirms a send.
 *
 * Renders three states:
 *  - loading  — simulation is in progress
 *  - error    — simulation failed (shows reason, blocks confirm)
 *  - success  — shows simulated fee and outcome
 *
 * Issue #671
 */

import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

export type SimulationState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; simulatedFee: string; outcome: string };

interface SimulationPreviewProps {
  simulation: SimulationState;
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
            Simulation Warning
          </span>
          <span className="leading-relaxed">{simulation.message}</span>
        </div>
      </div>
    );
  }

  // success
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
        <span className="font-mono text-slate-300">{simulation.simulatedFee} XLM</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-slate-500 uppercase tracking-widest font-bold text-[10px]">
          Expected Outcome
        </span>
        <span className="font-mono text-emerald-300 capitalize">{simulation.outcome}</span>
      </div>
    </div>
  );
}
