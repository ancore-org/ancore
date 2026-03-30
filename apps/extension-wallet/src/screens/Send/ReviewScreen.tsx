import { Button, Card, CardContent, CardHeader, CardTitle, Separator } from '@ancore/ui-kit';
import type { SendTransactionDraft } from '@/hooks/useSendTransaction';

interface ReviewScreenProps {
  transaction: SendTransactionDraft;
  onBack: () => void;
  onConfirm: () => void;
}

export function ReviewScreen({ transaction, onBack, onConfirm }: ReviewScreenProps) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Review transaction</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          <span className="font-medium">To:</span> {transaction.to}
        </p>
        <p>
          <span className="font-medium">Amount:</span> {transaction.amount} XLM
        </p>
        <p>
          <span className="font-medium">Network fee:</span> {transaction.fee.totalFee} XLM
        </p>
        <Separator />
        <p>
          <span className="font-medium">Total debit:</span> {transaction.total} XLM
        </p>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button type="button" onClick={onConfirm}>
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
