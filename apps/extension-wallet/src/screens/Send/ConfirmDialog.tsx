import { useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, PasswordInput } from '@ancore/ui-kit';
import type { SendTransactionDraft } from '@/hooks/useSendTransaction';

interface ConfirmDialogProps {
  transaction: SendTransactionDraft;
  error?: string;
  loading?: boolean;
  onBack: () => void;
  onSign: (password: string) => Promise<void>;
}

export function ConfirmDialog({ transaction, error, loading, onBack, onSign }: ConfirmDialogProps) {
  const [password, setPassword] = useState('');

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Confirm transaction</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Enter your wallet password to sign and submit this transaction.
        </p>
        <p className="text-sm">
          Sending <strong>{transaction.amount} XLM</strong>
        </p>

        <PasswordInput
          label="Wallet password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={error}
        />

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button type="button" disabled={loading} onClick={() => onSign(password)}>
            {loading ? 'Submitting...' : 'Sign & submit'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
