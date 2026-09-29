import { useState, useEffect, useCallback } from 'react';
import type { AccountData, Transaction } from '../types/dashboard';
import { fetchAccountData } from '../lib/horizon';

export interface UseAccountDataReturn {
  account: AccountData | null;
  transactions: Transaction[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useAccountData(address: string): UseAccountDataReturn {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAccountData(address);
      const nativeBalance = data.balances?.find((b) => b.asset_type === 'native');
      const balance = nativeBalance ? Number(nativeBalance.balance) : 0;
      const lastActivity = data.last_modified_time ? new Date(data.last_modified_time) : new Date();

      setAccount({
        address,
        balance,
        status: 'active',
        lastActivity,
      });
      setTransactions([]);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.includes('Account not found') || err.message.includes('404'))
      ) {
        setAccount({
          address,
          balance: 0,
          status: 'unfunded',
          lastActivity: new Date(),
        });
        setTransactions([]);
        setError(null);
      } else {
        setError(err instanceof Error ? err : new Error('Failed to fetch account data'));
        setAccount(null);
      }
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { account, transactions, loading, error, refetch: fetchData };
}
