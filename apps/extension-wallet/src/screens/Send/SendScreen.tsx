import { useState } from 'react';
import {
  AddressInput,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormAmountInput,
} from '@ancore/ui-kit';
import {
  useSendTransaction,
  type SendFormValues,
  type SendService,
} from '@/hooks/useSendTransaction';
import { ConfirmDialog } from '@/screens/Send/ConfirmDialog';
import { ReviewScreen } from '@/screens/Send/ReviewScreen';
import { StatusScreen } from '@/screens/Send/StatusScreen';

interface SendScreenProps {
  balance?: number;
  service?: SendService;
  pollIntervalMs?: number;
}

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
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Send transaction</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <AddressInput
          label="Recipient"
          placeholder="G..."
          value={form.to}
          error={send.errors.to}
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

        {send.errors.simulation && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-500 mb-4 animate-in fade-in slide-in-from-top-1">
            <strong>Simulation Failed:</strong> {send.errors.simulation}
          </div>
        )}

        <Button
          type="button"
          className="w-full"
          onClick={() => void send.goToReview(form)}
          loading={send.submitting}
          disabled={send.submitting}
        >
          {send.submitting ? 'Simulating...' : 'Review'}
        </Button>
      </CardContent>
    </Card>
  );
}
