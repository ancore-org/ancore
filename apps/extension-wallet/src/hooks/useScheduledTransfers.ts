import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ScheduledTransfer, ScheduledTransferExecutionLog } from '@ancore/types';
import {
  DEMO_ACCOUNT_ADDRESS,
  getExtensionSchedulerClient,
  type SchedulerClient,
} from '@/services/scheduler-client';

const REFRESH_INTERVAL_MS = 15_000;

export interface UseScheduledTransfersOptions {
  accountAddress?: string;
  client?: SchedulerClient;
  refreshIntervalMs?: number;
}

export function useScheduledTransfers(options: UseScheduledTransfersOptions = {}) {
  const accountAddress = options.accountAddress ?? DEMO_ACCOUNT_ADDRESS;
  const refreshIntervalMs = options.refreshIntervalMs ?? REFRESH_INTERVAL_MS;
  const client = useMemo(
    () => options.client ?? getExtensionSchedulerClient(),
    [options.client]
  );

  const [transfers, setTransfers] = useState<ScheduledTransfer[]>([]);
  const [executions, setExecutions] = useState<Record<string, ScheduledTransferExecutionLog[]>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    refresh,
    pauseTransfer,
    cancelTransfer,
  };
}
