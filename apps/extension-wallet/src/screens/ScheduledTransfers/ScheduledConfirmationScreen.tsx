import { Button, Card, CardContent, CardHeader, CardTitle } from '@ancore/ui-kit';
import type { ScheduledTransfer } from '@ancore/types';
import { CalendarCheck2, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ScheduledConfirmationScreenProps {
  transfer: ScheduledTransfer;
}

export function ScheduledConfirmationScreen({ transfer }: ScheduledConfirmationScreenProps) {
  return (
    <Card className="w-full max-w-md border-white/10 bg-slate-950 shadow-2xl">
      <CardHeader className="border-b border-white/5 bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 pb-6">
        <CardTitle className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-white">
          <CalendarCheck2 className="h-4 w-4 text-emerald-400" />
          Transfer Scheduled
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 px-6 pb-8 pt-6 text-sm text-slate-300">
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400" />
          <div className="space-y-1">
            <p className="font-semibold text-white">Your transfer was approved and scheduled.</p>
            <p className="text-xs text-slate-400">
              Execution outcomes will appear in your scheduled transfers list.
            </p>
          </div>
        </div>

        <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p>
            <span className="text-slate-500">Amount:</span> {transfer.amount} {transfer.asset}
          </p>
          <p>
            <span className="text-slate-500">Frequency:</span> {transfer.frequency}
          </p>
          <p>
            <span className="text-slate-500">Next run:</span>{' '}
            {new Date(transfer.nextRunAt).toLocaleString()}
          </p>
          <p>
            <span className="text-slate-500">Status:</span> {transfer.status}
          </p>
        </div>

        <Button asChild className="w-full rounded-2xl">
          <Link to="/scheduled">View scheduled transfers</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
