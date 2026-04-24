import { useState, useEffect, useCallback } from 'react';
import type { AccountData, Transaction } from '../types/dashboard';

const MOCK_ACCOUNT: AccountData = {
  address: 'GABC...XYZ',
  balance: 1250.75,
  status: 'active',
  lastActivity: new Date('2026-04-24T10:00:00Z'),
};

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 'tx1', type: 'receive', amount: 100, timestamp: new Date('2026-04-24T09:00:00Z'), status: 'confirmed', counterparty: 'GDEF...ABC' },
  { id: 'tx2', type: 'send',    amount: 50,  timestamp: new Date('2026-04-23T15:30:00Z'), status: 'confirmed', counterparty: 'GHIJ...DEF' },
  { id: 'tx3', type: 'send',    amount: 25,  timestamp: new Date('2026-04-22T08:00:00Z'), status: 'pending',   counterparty: 'GKLM...GHI' },
];

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
      await new Promise((r) => setTimeout(r, 400));
      setAccount({ ...MOCK_ACCOUNT, address });
      setTransactions(MOCK_TRANSACTIONS);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch account data'));
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { account, transactions, loading, error, refetch: fetchData };
}
