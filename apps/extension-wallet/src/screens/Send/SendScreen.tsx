import { useState } from 'react';
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
import {
  useSendTransaction,
  type SendFormValues,
  type SendService,
} from '@/hooks/useSendTransaction';
import { ConfirmDialog } from '@/screens/Send/ConfirmDialog';
import { ReviewScreen } from '@/screens/Send/ReviewScreen';
import { StatusScreen } from '@/screens/Send/StatusScreen';
import { SendHorizontal, Info, AlertCircle } from 'lucide-react';

interface SendScreenProps {
  balance?: number;
  service?: SendService;
  pollIntervalMs?: number;
}

/**
 * SendScreen — The initial form where the user enters transaction details.
 *
 * Implements a premium dark UI with real-time validation and simulation feedback.
 */
export function SendScreen({ balance, service, pollIntervalMs }: SendScreenProps) {
  const [form, setForm] = useState<SendFormValues>({ to: '', amount: '' });

  const send = useSendTransaction({ balance, service, pollIntervalMs });

  const onMax = () => {
    setForm((current) => ({ ...current, amount: String(send.balance) }));
    send.setMaxAmount();
  };

  if (send.step === 'review' && send.tx) {
    return (
      <ReviewScreen
        transaction={send.tx}
        onBack={() => send.setStep('form')}
        onConfirm={send.requestConfirm}
      />
    );
  }

  if (send.step === 'confirm' && send.tx) {
    return (
      <ConfirmDialog
        transaction={send.tx}
        error={send.errors.password}
        loading={send.submitting}
        onBack={() => send.setStep('review')}
        onSign={send.confirmAndSubmit}
      />
    );
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
            label="Recipient Address"
            placeholder="G..."
            value={form.to}
            error={send.errors.to}
            className="group"
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setForm((current) => ({ ...current, to: event.target.value }))
            }
          />

          <FormAmountInput
            label="Amount"
            asset="XLM"
            balance={send.balance.toString()}
            value={form.amount}
            error={send.errors.amount}
            onMax={onMax}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setForm((current) => ({
                ...current,
                amount: event.target.value,
              }))
            }
          />
        </div>

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
            onClick={() => void send.goToReview(form)}
            loading={send.submitting}
            disabled={send.submitting}
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
