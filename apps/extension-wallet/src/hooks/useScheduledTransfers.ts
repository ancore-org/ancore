import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ScheduledTransfer, ScheduledTransferExecutionLog } from '@ancore/types';
import {
  getExtensionSchedulerClient,
  type SchedulerClient,
} from '@/services/scheduler-client';
import { useAccountStore } from '@/stores/account';

const REFRESH_INTERVAL_MS = 15_000;

export interface UseScheduledTransfersOptions {
  /**
   * Stellar address of the account whose transfers to load.
   * Defaults to the currently active account in the extension wallet store.
   * If no account is active, the hook returns an empty list instead of
   * falling back to the demo/placeholder address.
   */
  accountAddress?: string;
  client?: SchedulerClient;
  refreshIntervalMs?: number;
}

export function useScheduledTransfers(options: UseScheduledTransfersOptions = {}) {
  // Resolve the vault address from the live account store when not explicitly
  // provided by the caller.  This removes the DEMO_ACCOUNT_ADDRESS fallback
  // that was used while the store was not yet wired up.
  const activeAccountAddress = useAccountStore((state) => {
    if (options.accountAddress) return null; // caller is explicit — skip store lookup
    const active = state.accounts.find((a) => a.id === state.activeAccountId);
    return active?.address ?? null;
  });

  const accountAddress = options.accountAddress ?? activeAccountAddress;
  const refreshIntervalMs = options.refreshIntervalMs ?? REFRESH_INTERVAL_MS;
  const client = useMemo(() => options.client ?? getExtensionSchedulerClient(), [options.client]);

  const [transfers, setTransfers] = useState<ScheduledTransfer[]>([]);
  const [executions, setExecutions] = useState<Record<string, ScheduledTransferExecutionLog[]>>({});
  const [loading, setLoading] = useState(accountAddress !== null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accountAddress) {
      // No active account — return empty state rather than erroring.
      setTransfers([]);
      setExecutions({});
      setLoading(false);
      return;
    }

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
    accountAddress,
    refresh,
    pauseTransfer,
    cancelTransfer,
  };
}
