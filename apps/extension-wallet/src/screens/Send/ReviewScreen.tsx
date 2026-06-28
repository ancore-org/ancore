import { useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Separator, cn } from '@ancore/ui-kit';
import type { SendTransactionDraft } from '@/hooks/useSendTransaction';
import { TransferNotePreview } from '@/components/TransferNotePreview';
import {
  ShieldCheck,
  ArrowRight,
  Wallet,
  Globe,
  Info,
  AlertCircle,
  CalendarClock,
} from 'lucide-react';
import type { ScheduleConfig, TransferTiming } from '@/screens/Send/ScheduleControls';
import { SimulationPreview, type SimulationState } from './SimulationPreview';

interface ReviewScreenProps {
  transaction: SendTransactionDraft;
  timing?: TransferTiming;
  schedule?: ScheduleConfig;
  /** Simulation state — when provided, shows the preview panel above the fee summary. */
  simulation?: SimulationState;
  onBack: () => void;
  onConfirm: () => void;
}

/**
 * ReviewScreen — The final confirmation step before the user signs the transaction.
 *
 * Implements a high-visibility layout showing the recipient, amount, and fees.
 * To prevent misdirected payments, the "Continue" button is blocked until the
 * user explicitly interacts with the recipient confirmation checkbox.
 */
export function ReviewScreen({
  transaction,
  timing,
  schedule,
  simulation,
  onBack,
  onConfirm,
}: ReviewScreenProps) {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [simulationSkipped, setSimulationSkipped] = useState(false);
  const isDev = import.meta.env.DEV;

  const simulatedFee =
    simulation?.status === 'success' ? simulation.simulatedFee : transaction.fee.totalFee;
  const displayTotal =
    simulation?.status === 'success'
      ? (Number(transaction.amount) + Number(simulatedFee)).toFixed(7)
      : transaction.total;

  const simulationBlocksApprove =
    simulation?.status === 'loading' ||
    (simulation?.status === 'error' && !(isDev && simulationSkipped));

  return (
    <Card className="w-full max-w-md bg-slate-950 border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
      <CardHeader className="bg-gradient-to-br from-cyan-500/10 to-blue-500/5 pb-6 border-b border-white/5">
        <CardTitle className="text-white uppercase tracking-widest text-xs flex items-center justify-center gap-2 font-black">
          <ShieldCheck className="text-cyan-400 w-4 h-4" />
          Review Transaction
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6 pt-6 px-6 pb-8">
        {/* Recipient Box */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 px-1">
            <Wallet className="w-3 h-3 text-slate-500" />
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
              Recipient Address
            </span>
          </div>
          {(transaction.resolvedHandle || transaction.recipientInput?.startsWith('@')) && (
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-3 text-xs text-cyan-100">
              <span className="font-black uppercase tracking-widest text-[10px] text-cyan-300">
                Resolved handle
              </span>
              <div className="mt-1 font-semibold">
                {transaction.resolvedHandle?.handle ?? transaction.recipientInput}
                {transaction.resolvedHandle?.displayName
                  ? ` · ${transaction.resolvedHandle.displayName}`
                  : ''}
              </div>
            </div>
          )}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 break-all font-mono text-[11px] text-cyan-300 leading-relaxed shadow-inner group transition-colors hover:border-cyan-400/30">
            {transaction.to}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Amount */}
          <div className="space-y-1 bg-white/5 border border-white/10 rounded-2xl p-4 transition-all hover:bg-white/[0.07]">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-1">
              Amount
            </span>
            <div className="text-lg font-black text-white leading-none">
              {transaction.amount}{' '}
              <span className="text-[10px] text-slate-400 font-bold ml-1 uppercase">XLM</span>
            </div>
          </div>
          {/* Network */}
          <div className="space-y-1 bg-white/5 border border-white/10 rounded-2xl p-4 transition-all hover:bg-white/[0.07]">
            <div className="flex items-center gap-1 mb-1">
              <Globe className="w-3 h-3 text-slate-500" />
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                Network
              </span>
            </div>
            <div className="capitalize text-emerald-400 font-bold text-sm flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {transaction.fee.network}
            </div>
          </div>
        </div>

        {/* Transfer Note */}
        {transaction.truncatedNote && <TransferNotePreview note={transaction.truncatedNote} />}

        {transaction.policyAction === 'step_up' && transaction.policyMessage && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <AlertCircle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <strong className="block text-[11px] uppercase tracking-widest text-amber-300 font-black">
                Verification Required
              </strong>
              <p className="text-[10px] text-amber-200 leading-relaxed">
                {transaction.policyMessage}
              </p>
            </div>
          </div>
        )}

        {timing === 'scheduled' && schedule && (
          <div className="space-y-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-cyan-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-cyan-300">
                Scheduled Transfer
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Frequency: <span className="font-semibold text-white">{schedule.frequency}</span>
            </p>
            <p className="text-xs text-slate-300">
              Starts:{' '}
              <span className="font-semibold text-white">
                {new Date(schedule.startAt).toLocaleString()}
              </span>
            </p>
            {schedule.endAt && (
              <p className="text-xs text-slate-300">
                Ends:{' '}
                <span className="font-semibold text-white">
                  {new Date(schedule.endAt).toLocaleString()}
                </span>
              </p>
            )}
          </div>
        )}

        {/* Fees Summary */}
        <div className="space-y-3 bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex justify-between items-center text-[10px] font-bold">
            <span className="text-slate-500 uppercase tracking-widest">
              {simulation?.status === 'success' ? 'Simulated Network Fee' : 'Base Network Fee'}
            </span>
            <span className="text-slate-300 font-mono" data-testid="review-network-fee">
              {simulatedFee} XLM
            </span>
          </div>
          <Separator className="bg-white/5" />
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              Total to Debit
            </span>
            <span
              className="text-cyan-400 font-mono text-base font-black"
              data-testid="review-total"
            >
              {displayTotal} XLM
            </span>
          </div>
        </div>

        {/* Simulation Preview */}
        {simulation && <SimulationPreview simulation={simulation} />}

        {isDev && simulation?.status === 'error' && !simulationSkipped && (
          <button
            type="button"
            className="w-full text-[10px] uppercase tracking-widest text-amber-300/80 hover:text-amber-200"
            data-testid="skip-simulation-dev"
            onClick={() => setSimulationSkipped(true)}
          >
            Skip simulation (dev only)
          </button>
        )}

        {/* Explicit Confirmation Step */}
        <div
          className={cn(
            'p-4 rounded-2xl border flex items-start gap-3 transition-all cursor-pointer select-none group',
            isConfirmed
              ? 'bg-cyan-400/10 border-cyan-400/30'
              : 'bg-slate-800/50 border-white/5 hover:border-white/20'
          )}
          onClick={() => setIsConfirmed(!isConfirmed)}
        >
          <div
            className={cn(
              'mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0',
              isConfirmed
                ? 'bg-cyan-400 border-cyan-400 text-slate-950 shadow-[0_0_10px_rgba(34,211,238,0.5)]'
                : 'border-slate-600 group-hover:border-cyan-400/50'
            )}
          >
            {isConfirmed && (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-3 h-3 stroke-[4]"
                stroke="currentColor"
              >
                <path d="M20 6L9 17L4 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <div className="space-y-1">
            <span className="text-[11px] text-slate-200 leading-tight font-black block uppercase tracking-wide">
              Confirm Recipient
            </span>
            <span className="text-[10px] text-slate-400 leading-relaxed block font-medium">
              I have verified the resolved recipient above and confirm it is correct.
              <span className="text-amber-400/80"> Payments are irreversible.</span>
            </span>
          </div>
        </div>

        {/* Navigation Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            className="flex-1 text-slate-500 hover:text-white hover:bg-white/5 rounded-2xl border border-white/5 h-12 text-[10px] font-black uppercase tracking-widest transition-all"
            onClick={onBack}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!isConfirmed || simulationBlocksApprove}
            className="flex-[2] bg-cyan-400 text-slate-950 font-black uppercase tracking-widest rounded-2xl h-12 shadow-[0_10px_20px_rgba(34,211,238,0.2)] hover:bg-cyan-300 disabled:opacity-50 disabled:grayscale transition-all flex items-center justify-center gap-2 text-[10px]"
            onClick={onConfirm}
          >
            Continue to Sign
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[8px] text-slate-700 uppercase tracking-widest font-black pt-2">
          <Info className="w-3 h-3 opacity-50" />
          Securely encrypted by Ancore Core SDK
        </div>
      </CardContent>
    </Card>
  );
}
