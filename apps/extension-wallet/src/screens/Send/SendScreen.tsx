import { useState, useEffect } from 'react';
import { isMemoRequired } from '@/utils/memoCheck';
import {
  AddressInput,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormAmountInput,
  cn,
} from '@ancore/ui-kit';
import { BASE_SEND_RESERVE, DEFAULT_SEND_FEE } from '@/utils/amount';
import {
  useSendTransaction,
  type SendFormValues,
  type SendService,
} from '@/hooks/useSendTransaction';
import { useRecentRecipients } from '@/hooks/useRecentRecipients';
import { ConfirmDialog } from '@/screens/Send/ConfirmDialog';
import { ReviewScreen } from '@/screens/Send/ReviewScreen';
import { StatusScreen } from '@/screens/Send/StatusScreen';
import { TransferNoteInput } from '@/components/TransferNoteInput';
import { SendHorizontal, Info, AlertCircle } from 'lucide-react';
import {
  ScheduleControls,
  createDefaultScheduleConfig,
  type ScheduleConfig,
  type TransferTiming,
} from '@/screens/Send/ScheduleControls';
import { ScheduledConfirmationScreen } from '@/screens/ScheduledTransfers/ScheduledConfirmationScreen';

interface SendScreenProps {
  balance?: number;
  /** Maximum decimal places for the asset being sent. Defaults to 7 (XLM). */
  assetDecimals?: number;
  service?: SendService;
  pollIntervalMs?: number;
}

/**
 * SendScreen — The initial form where the user enters transaction details.
 *
 * Implements a premium dark UI with real-time validation and simulation feedback.
 */
export function SendScreen({ balance, assetDecimals, service, pollIntervalMs }: SendScreenProps) {
  const [form, setForm] = useState<SendFormValues>({
    to: '',
    amount: '',
    note: '',
    timing: 'immediate',
    schedule: createDefaultScheduleConfig(),
  });

  const send = useSendTransaction({ balance, assetDecimals, service, pollIntervalMs });
  const { recipients, addRecipient } = useRecentRecipients();
  const [memoWarning, setMemoWarning] = useState<string | null>(null);

  const isMainnet = send.tx?.fee?.network === 'mainnet' || !send.tx;

  useEffect(() => {
    setMemoWarning(null);
    if (!form.to || !isMainnet) return;
    isMemoRequired(form.to).then((required) => {
      if (required && !form.note) {
        setMemoWarning(
          'This address belongs to an exchange and requires a memo. Add a memo or funds may be lost.'
        );
      }
    });
  }, [form.to, form.note, isMainnet]);

  const balanceDisplay = balance !== undefined ? balance.toString() : undefined;
  const maxDisabled = balance === undefined || balance <= BASE_SEND_RESERVE + DEFAULT_SEND_FEE;

  const onMax = async () => {
    const maxAmount = await send.setMaxAmount({ to: form.to, asset: 'XLM' });
    setForm((current) => ({ ...current, amount: maxAmount }));
  };

  const handleReview = async () => {
    if (memoWarning) return;
    const success = await send.goToReview(form);
    if (success) {
      await addRecipient({ address: send.tx?.to ?? form.to });
    }
  };

  if (send.step === 'review' && send.tx) {
    return (
      <ReviewScreen
        transaction={send.tx}
        timing={send.timing}
        schedule={send.schedule}
        simulation={send.simulation}
        onBack={() => send.setStep('form')}
        onConfirm={send.requestConfirm}
      />
    );
  }

  if (send.step === 'confirm' && send.tx) {
    return (
      <ConfirmDialog
        transaction={send.tx}
        timing={send.timing}
        error={send.errors.password}
        loading={send.submitting}
        onBack={() => send.setStep('review')}
        onSign={send.confirmAndSubmit}
      />
    );
  }

  if (send.step === 'scheduled' && send.scheduledTransfer) {
    return <ScheduledConfirmationScreen transfer={send.scheduledTransfer} />;
  }

  if (send.step === 'status' && send.txId) {
    return <StatusScreen txId={send.txId} status={send.status} />;
  }

  return (
    <Card className="w-full max-w-md bg-slate-950 border-white/10 shadow-2xl overflow-hidden animate-in fade-in duration-500">
      <CardHeader className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 pb-6 border-b border-white/5">
        <CardTitle className="text-white uppercase tracking-widest text-xs flex items-center justify-center gap-2 font-black">
          <SendHorizontal className="text-cyan-400 w-4 h-4" />
          Send Assets
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6 pt-8 px-6 pb-8">
        <div className="space-y-6">
          <AddressInput
            label="Recipient"
            placeholder="@username or G..."
            value={form.to}
            error={send.errors.to}
            className="group"
            recentRecipients={recipients}
            onSelectRecent={(address) => setForm((current) => ({ ...current, to: address }))}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setForm((current) => ({ ...current, to: event.target.value }))
            }
          />

          <FormAmountInput
            label="Amount"
            asset="XLM"
            balance={balanceDisplay}
            value={form.amount}
            error={send.errors.amount}
            onMax={onMax}
            maxDisabled={maxDisabled}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setForm((current) => ({
                ...current,
                amount: event.target.value,
              }))
            }
          />

          <TransferNoteInput
            value={form.note || ''}
            onChange={(note) => setForm((current) => ({ ...current, note }))}
            error={send.errors.note}
            placeholder="Add a note (optional)"
          />

          <ScheduleControls
            timing={(form.timing ?? 'immediate') as TransferTiming}
            schedule={(form.schedule ?? createDefaultScheduleConfig()) as ScheduleConfig}
            error={send.errors.simulation}
            onTimingChange={(timing) =>
              setForm((current) => ({
                ...current,
                timing,
                schedule: current.schedule ?? createDefaultScheduleConfig(),
              }))
            }
            onScheduleChange={(schedule) =>
              setForm((current) => ({
                ...current,
                timing: 'scheduled',
                schedule,
              }))
            }
          />
        </div>

        {memoWarning && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400 animate-in fade-in slide-in-from-top-2 duration-300 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <div className="space-y-1">
              <strong className="block uppercase tracking-wider font-black">Memo Required</strong>
              <p className="font-medium leading-relaxed">{memoWarning}</p>
            </div>
          </div>
        )}

        {send.errors.simulation && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-[10px] text-red-400 mb-4 animate-in fade-in slide-in-from-top-2 duration-300 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <div className="space-y-1">
              <strong className="block uppercase tracking-wider font-black">
                Simulation Failed
              </strong>
              <p className="font-medium leading-relaxed">{send.errors.simulation}</p>
            </div>
          </div>
        )}

        <div className="pt-2">
          <Button
            type="button"
            className={cn(
              'w-full h-14 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] transition-all duration-300',
              'bg-cyan-400 text-slate-950 shadow-[0_15px_30px_rgba(34,211,238,0.15)] hover:bg-cyan-300 hover:scale-[1.02] hover:shadow-[0_20px_40px_rgba(34,211,238,0.2)]',
              'disabled:opacity-50 disabled:grayscale disabled:scale-100'
            )}
            onClick={handleReview}
            loading={send.submitting}
            disabled={send.submitting || !!memoWarning}
          >
            {send.submitting ? 'Calculating...' : 'Review Transaction'}
          </Button>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[8px] text-slate-700 uppercase tracking-widest font-black pt-2">
          <Info className="w-3 h-3 opacity-50" />
          Fees are estimated based on current network load
        </div>
      </CardContent>
    </Card>
  );
}
