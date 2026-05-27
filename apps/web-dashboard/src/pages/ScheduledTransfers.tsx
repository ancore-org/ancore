import { useState } from 'react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@ancore/ui-kit';
import type { ScheduleFrequency } from '@ancore/types';
import {
  useScheduledTransfers,
  type CreateScheduledTransferForm,
} from '../hooks/useScheduledTransfers';
import { SCHEDULE_FREQUENCY_OPTIONS } from '../services/scheduler-client';
import { ExecutionLogPanel } from '../components/ExecutionLogPanel';

function defaultStartAt(): string {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setSeconds(0, 0);
  return date.toISOString().slice(0, 16);
}

export function ScheduledTransfersPage() {
  const { transfers, executions, loading, error, submitting, createTransfer, pauseTransfer, cancelTransfer } =
    useScheduledTransfers();

  const [form, setForm] = useState<CreateScheduledTransferForm>({
    to: '',
    amount: '',
    frequency: 'once',
    startAt: defaultStartAt(),
  });
  const [approved, setApproved] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!approved) {
      return;
    }
    await createTransfer(form);
    setForm({ to: '', amount: '', frequency: 'once', startAt: defaultStartAt() });
    setApproved(false);
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-semibold">Scheduled Transfers</h2>
        <p className="mt-2 text-sm text-slate-600">
          Create one-time or recurring transfers with explicit approval. Execution outcomes appear
          below after each run.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Create scheduled transfer</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => void onSubmit(event)}>
            <label className="block text-sm">
              Recipient
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={form.to}
                onChange={(event) => setForm((current) => ({ ...current, to: event.target.value }))}
                placeholder="G..."
                required
              />
            </label>
            <label className="block text-sm">
              Amount (XLM)
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={form.amount}
                onChange={(event) =>
                  setForm((current) => ({ ...current, amount: event.target.value }))
                }
                required
              />
            </label>
            <label className="block text-sm">
              Frequency
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={form.frequency}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    frequency: event.target.value as ScheduleFrequency,
                  }))
                }
              >
                {SCHEDULE_FREQUENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Start date & time
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={form.startAt}
                onChange={(event) =>
                  setForm((current) => ({ ...current, startAt: event.target.value }))
                }
                required
              />
            </label>
            {form.frequency !== 'once' && (
              <label className="block text-sm md:col-span-2">
                End date (optional)
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={form.endAt ?? ''}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      endAt: event.target.value || undefined,
                    }))
                  }
                />
              </label>
            )}
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={approved}
                onChange={(event) => setApproved(event.target.checked)}
              />
              I approve creating this scheduled transfer
            </label>
            <div className="md:col-span-2">
              <Button disabled={!approved || submitting} type="submit">
                {submitting ? 'Creating...' : 'Create scheduled transfer'}
              </Button>
            </div>
          </form>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scheduled jobs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && <p className="text-sm text-slate-500">Loading scheduled transfers...</p>}
          {!loading && transfers.length === 0 && (
            <p className="text-sm text-slate-500">No scheduled transfers yet.</p>
          )}
          {transfers.map((transfer) => {
            const transferExecutions = executions[transfer.id] ?? [];
            return (
              <div
                key={transfer.id}
                className="space-y-3 border-b border-slate-200 pb-4 last:border-0 last:pb-0"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium">
                      {transfer.amount} {transfer.asset} → {transfer.to.slice(0, 12)}...
                    </p>
                    <p className="text-sm text-slate-500">
                      {transfer.frequency} · next run {new Date(transfer.nextRunAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={transfer.status === 'active' ? 'default' : 'secondary'}>
                      {transfer.status}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={transfer.status !== 'active'}
                      onClick={() => void pauseTransfer(transfer.id)}
                    >
                      Pause
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={transfer.status === 'cancelled' || transfer.status === 'completed'}
                      onClick={() => void cancelTransfer(transfer.id)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">Execution history</p>
                  <ExecutionLogPanel executions={transferExecutions} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
