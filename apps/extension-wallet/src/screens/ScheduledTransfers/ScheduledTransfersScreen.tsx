import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@ancore/ui-kit';
import { CalendarClock, Pause, XCircle } from 'lucide-react';
import { useScheduledTransfers } from '@/hooks/useScheduledTransfers';
import { ExecutionLogPanel } from '@/components/ExecutionLogPanel';

export function ScheduledTransfersScreen() {
  const { transfers, executions, loading, error, pauseTransfer, cancelTransfer } =
    useScheduledTransfers();

  return (
    <Card className="w-full max-w-md border-white/10 bg-slate-950 shadow-2xl">
      <CardHeader className="border-b border-white/5 bg-gradient-to-br from-cyan-500/10 to-blue-500/5 pb-6">
        <CardTitle className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-white">
          <CalendarClock className="h-4 w-4 text-cyan-400" />
          Scheduled Transfers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-6 pb-8 pt-6">
        {loading && <p className="text-sm text-slate-400">Loading scheduled transfers...</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {!loading && transfers.length === 0 && (
          <p className="text-sm text-slate-400">No scheduled transfers yet.</p>
        )}

        {transfers.map((transfer) => {
          const transferExecutions = executions[transfer.id] ?? [];

          return (
            <div
              key={transfer.id}
              className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {transfer.amount} {transfer.asset}
                  </p>
                  <p className="text-xs text-slate-400">To {transfer.to.slice(0, 12)}...</p>
                </div>
                <Badge className="" variant={transfer.status === 'active' ? 'default' : 'secondary'}>
                  {transfer.status}
                </Badge>
              </div>

              <div className="text-xs text-slate-400">
                <p>Frequency: {transfer.frequency}</p>
                <p>Next run: {new Date(transfer.nextRunAt).toLocaleString()}</p>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
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
