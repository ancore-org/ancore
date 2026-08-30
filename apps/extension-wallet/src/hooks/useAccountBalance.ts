import { useState, useEffect, useCallback, useMemo } from 'react';
import { AccountNotFoundError, createStellarClient } from '@ancore/stellar';
import { useAccountStore } from '@/stores/account';
import { useDashboardSettingsStore } from '@/state/dashboard-settings';

interface UseAccountBalanceReturn {
  balance: number;
  isLoading: boolean;
  error: Error | null;
  refreshBalance: () => Promise<void>;
}

const POLL_INTERVAL_MS = 30_000;
const BALANCE_CHANGE_THRESHOLD = 0.001;

/**
 * Hook for fetching and managing the active account's native XLM balance
 * via the configured Stellar network client.
 */
export function useAccountBalance(): UseAccountBalanceReturn {
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const activeAccountId = useAccountStore((state) => state.activeAccountId);
  const accounts = useAccountStore((state) => state.accounts);
  const publicKey = useMemo(() => {
    const active = accounts.find((a) => a.id === activeAccountId) ?? accounts[0];
    return active?.address ?? null;
  }, [accounts, activeAccountId]);

  const network = useDashboardSettingsStore((state) => state.network);
  const stellarClient = useMemo(() => createStellarClient(network), [network]);

  const fetchBalance = useCallback(async (): Promise<number> => {
    if (!publicKey) {
      return 0;
    }

    try {
      const balances = await stellarClient.getBalances(publicKey);
      const native = balances.find((entry) => entry.assetType === 'native');
      return native ? Number(native.balance) : 0;
    } catch (err) {
      if (err instanceof AccountNotFoundError) {
        return 0;
      }
      throw err;
    }
  }, [publicKey, stellarClient]);

  const refreshBalance = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const newBalance = await fetchBalance();
      setBalance(newBalance);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch balance'));
      console.error('Balance fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchBalance]);

  useEffect(() => {
    void refreshBalance();
  }, [refreshBalance]);

  useEffect(() => {
    if (isLoading || error) return;

    const interval = setInterval(() => {
      fetchBalance()
        .then((newBalance) => {
          setBalance((current) =>
            Math.abs(newBalance - current) > BALANCE_CHANGE_THRESHOLD ? newBalance : current
          );
        })
        .catch((err) => {
          console.debug('Background balance update failed:', err);
        });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [fetchBalance, isLoading, error]);

  return {
    balance,
    isLoading,
    error,
    refreshBalance,
  };
}

/**
 * Utility function to format balance for display
 */
export function formatBalance(
  balance: number,
  options: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    currency?: string;
  } = {}
): string {
  const { minimumFractionDigits = 2, maximumFractionDigits = 6, currency = 'XLM' } = options;

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(balance);

  return currency ? `${formatted} ${currency}` : formatted;
}

export default useAccountBalance;
