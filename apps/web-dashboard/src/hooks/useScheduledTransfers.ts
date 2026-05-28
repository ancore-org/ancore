import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CreateScheduledTransferInput,
  ScheduledTransfer,
  ScheduledTransferExecutionLog,
  ScheduleFrequency,
} from '@ancore/types';
import {
  buildDefaultRelayPayload,
  createSchedulerClient,
  DEMO_ACCOUNT_ADDRESS,
  type SchedulerClient,
} from '../services/scheduler-client';
import { useDashboardAuth } from '../auth';

const REFRESH_INTERVAL_MS = 15_000;

export interface CreateScheduledTransferForm {
  to: string;
  amount: string;
  frequency: ScheduleFrequency;
  startAt: string;
  endAt?: string;
  note?: string;
}

export interface UseScheduledTransfersOptions {
  accountAddress?: string;
  client?: SchedulerClient;
  refreshIntervalMs?: number;
}

export function useScheduledTransfers(options: UseScheduledTransfersOptions = {}) {
  const { session } = useDashboardAuth();
  const accountAddress = options.accountAddress ?? DEMO_ACCOUNT_ADDRESS;
  const refreshIntervalMs = options.refreshIntervalMs ?? REFRESH_INTERVAL_MS;
  const client = useMemo(
    () =>
      options.client ??
      createSchedulerClient({
        baseUrl: import.meta.env.VITE_RELAYER_URL ?? 'http://localhost:3000',
        getAuthToken: () => session?.accessToken ?? 'ancore-client-token',
      }),
    [options.client, session?.accessToken]
  );

  const [transfers, setTransfers] = useState<ScheduledTransfer[]>([]);
  const [executions, setExecutions] = useState<Record<string, ScheduledTransferExecutionLog[]>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);

    try {
      const nextTransfers = await client.listScheduledTransfers(accountAddress);
      setTransfers(nextTransfers);

      const nextExecutions: Record<string, ScheduledTransferExecutionLog[]> = {};
      await Promise.all(
        nextTransfers.map(async (transfer) => {
          nextExecutions[transfer.id] = await client.listExecutions(transfer.id);
        })
      );
      setExecutions(nextExecutions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scheduled transfers');
    } finally {
      setLoading(false);
    }
  }, [accountAddress, client]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, refreshIntervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [refresh, refreshIntervalMs]);

  const createTransfer = useCallback(
    async (form: CreateScheduledTransferForm) => {
      setSubmitting(true);
      setError(null);

      try {
        const input: CreateScheduledTransferInput = {
          accountAddress,
          to: form.to,
          amount: form.amount,
          asset: 'XLM',
          frequency: form.frequency,
          startAt: new Date(form.startAt).toISOString(),
          endAt: form.endAt ? new Date(form.endAt).toISOString() : undefined,
          note: form.note,
          userApproved: true,
          relayPayload: buildDefaultRelayPayload(form.to, form.amount),
        };

        await client.createScheduledTransfer(input);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create scheduled transfer');
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [accountAddress, client, refresh]
  );

  const pauseTransfer = useCallback(
    async (id: string) => {
      await client.pauseScheduledTransfer(id);
      await refresh();
    },
    [client, refresh]
  );

  const cancelTransfer = useCallback(
    async (id: string) => {
      await client.cancelScheduledTransfer(id);
      await refresh();
    },
    [client, refresh]
  );

  return {
    transfers,
    executions,
    loading,
    error,
    submitting,
    refresh,
    createTransfer,
    pauseTransfer,
    cancelTransfer,
  };
}
