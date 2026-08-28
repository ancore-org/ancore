import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@ancore/ui-kit';
import { CalendarClock, Pause, XCircle } from 'lucide-react';
import { useScheduledTransfers } from '@/hooks/useScheduledTransfers';
import { ExecutionLogPanel } from '@/components/ExecutionLogPanel';

export function ScheduledTransfersScreen() {
  const { transfers, executions, loading, error, pauseTransfer, cancelTransfer } =
    useScheduledTransfers();

  return (
    <Card className="w-full max-w-md border-border bg-card">
      <CardHeader className="border-b border-border pb-5">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          Upcoming transfers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-6 pb-8 pt-6">
        {loading && <p className="text-sm text-muted-foreground">Loading scheduled transfers...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {!loading && transfers.length === 0 && (
          <p className="text-sm text-muted-foreground">No scheduled transfers yet.</p>
        )}

        {transfers.map((transfer) => {
          const transferExecutions = executions[transfer.id] ?? [];

          return (
            <div
              key={transfer.id}
              className="space-y-3 rounded-2xl border border-border bg-[hsl(var(--surface-sunken))] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {transfer.amount} {transfer.asset}
                  </p>
                  <p className="text-xs text-muted-foreground">To {transfer.to.slice(0, 12)}...</p>
                </div>
                <Badge
                  className=""
                  variant={transfer.status === 'active' ? 'default' : 'secondary'}
                >
                  {transfer.status}
                </Badge>
              </div>

              <div className="text-xs text-muted-foreground">
                <p>Frequency: {transfer.frequency}</p>
                <p>Next run: {new Date(transfer.nextRunAt).toLocaleString()}</p>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Execution history
                </p>
                <ExecutionLogPanel executions={transferExecutions} />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={transfer.status !== 'active'}
                  onClick={() => void pauseTransfer(transfer.id)}
                >
                  <Pause className="mr-1 h-3 w-3" />
                  Pause
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={transfer.status === 'cancelled' || transfer.status === 'completed'}
                  onClick={() => void cancelTransfer(transfer.id)}
                >
                  <XCircle className="mr-1 h-3 w-3" />
                  Cancel
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
