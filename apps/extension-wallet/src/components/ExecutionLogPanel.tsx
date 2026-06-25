import type { ScheduledTransferExecutionLog } from '@ancore/types';

interface ExecutionLogPanelProps {
  executions: ScheduledTransferExecutionLog[];
  emptyMessage?: string;
}

export function ExecutionLogPanel({
  executions,
  emptyMessage = 'No executions yet.',
}: ExecutionLogPanelProps) {
  if (executions.length === 0) {
    return <p className="text-xs text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-2">
      {executions.slice(0, 5).map((execution) => (
        <div
          key={execution.id}
          className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold capitalize text-slate-200">{execution.outcome}</span>
            <span>{new Date(execution.executedAt).toLocaleString()}</span>
          </div>
          {execution.transactionId && (
            <p className="mt-1 font-mono text-cyan-300/80">
              Tx: {execution.transactionId.slice(0, 16)}...
            </p>
          )}
          {execution.error && <p className="mt-1 text-red-400">{execution.error}</p>}
        </div>
      ))}
    </div>
  );
}
