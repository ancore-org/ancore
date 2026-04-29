import { useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Separator, cn } from '@ancore/ui-kit';
import type { SendTransactionDraft } from '@/hooks/useSendTransaction';
import { ShieldCheck, ArrowRight, Wallet, Globe, Info } from 'lucide-react';

interface ReviewScreenProps {
  transaction: SendTransactionDraft;
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
export function ReviewScreen({ transaction, onBack, onConfirm }: ReviewScreenProps) {
  const [isConfirmed, setIsConfirmed] = useState(false);

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

        {/* Fees Summary */}
        <div className="space-y-3 bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex justify-between items-center text-[10px] font-bold">
            <span className="text-slate-500 uppercase tracking-widest">Base Network Fee</span>
            <span className="text-slate-300 font-mono">{transaction.fee.baseFee} XLM</span>
          </div>
          <Separator className="bg-white/5" />
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              Total to Debit
            </span>
            <span className="text-cyan-400 font-mono text-base font-black">
              {transaction.total} XLM
            </span>
          </div>
        </div>

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
              I have verified the address above and confirm it is correct.
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
            disabled={!isConfirmed}
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
