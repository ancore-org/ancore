import { Badge, Card, CardContent, CardHeader, CardTitle } from '@ancore/ui-kit';
import type { TxStatus } from '@/hooks/useSendTransaction';

interface StatusScreenProps {
  txId: string;
  status: TxStatus;
}

const STATUS_LABELS: Record<TxStatus, string> = {
  idle: 'Idle',
  pending: 'Pending',
  confirmed: 'Confirmed',
  failed: 'Failed',
};

export function StatusScreen({ txId, status }: StatusScreenProps) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Transaction status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          <span className="font-medium">Transaction ID:</span> {txId}
        </p>
        <div>
          <Badge variant="outline">{STATUS_LABELS[status]}</Badge>
        </div>
        {status === 'pending' && <p>Waiting for network confirmation...</p>}
        {status === 'confirmed' && <p>Success! The transaction has been confirmed.</p>}
        {status === 'failed' && <p>Transaction failed. Please review and try again.</p>}
      </CardContent>
    </Card>
  );
}
