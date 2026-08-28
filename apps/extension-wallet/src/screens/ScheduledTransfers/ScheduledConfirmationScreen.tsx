import { Button, Card, CardContent, CardHeader, CardTitle } from '@ancore/ui-kit';
import type { ScheduledTransfer } from '@ancore/types';
import { CalendarCheck2, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ScheduledConfirmationScreenProps {
  transfer: ScheduledTransfer;
}

export function ScheduledConfirmationScreen({ transfer }: ScheduledConfirmationScreenProps) {
  return (
    <Card className="w-full max-w-md border-border bg-card">
      <CardHeader className="border-b border-border pb-5">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CalendarCheck2 className="h-4 w-4 text-success" />
          Transfer Scheduled
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 px-6 pb-8 pt-6 text-sm text-muted-foreground">
        <div className="flex items-start gap-3 rounded-2xl border border-success/20 bg-success/10 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              Your transfer was approved and scheduled.
            </p>
            <p className="text-xs text-muted-foreground">
              Execution outcomes will appear in your scheduled transfers list.
            </p>
          </div>
        </div>

        <div className="space-y-2 rounded-2xl border border-border bg-accent p-4">
          <p>
            <span className="text-muted-foreground">Amount:</span> {transfer.amount}{' '}
            {transfer.asset}
          </p>
          <p>
            <span className="text-muted-foreground">Frequency:</span> {transfer.frequency}
          </p>
          <p>
            <span className="text-muted-foreground">Next run:</span>{' '}
            {new Date(transfer.nextRunAt).toLocaleString()}
          </p>
          <p>
            <span className="text-muted-foreground">Status:</span> {transfer.status}
          </p>
        </div>

        <Button asChild className="w-full">
          <Link to="/scheduled">View scheduled transfers</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
