import { useState, useEffect, useCallback } from 'react';
import type { AccountData } from '../types/dashboard';

const STORAGE_KEY = 'ancore-dashboard-selected-account';

const MOCK_ACCOUNTS: AccountData[] = [
  {
    address: 'GABC123DEF456GHI789JKL012MNO345PQR678STU901VWX234YZ',
    balance: 1250.75,
    status: 'active',
    lastActivity: new Date('2026-04-24T10:00:00Z'),
  },
  {
    address: 'GDEF789GHI012JKL345MNO678PQR901STU234VWX567YZA890BCD',
    balance: 845.2,
    status: 'active',
    lastActivity: new Date('2026-04-23T15:30:00Z'),
  },
  {
    address: 'GJKL345MNO678PQR901STU234VWX567YZA890BCD123DEF456GHI',
    balance: 2100.0,
    status: 'inactive',
    lastActivity: new Date('2026-04-20T09:15:00Z'),
  },
  {
    address: 'GMNO678PQR901STU234VWX567YZA890BCD123DEF456GHI789JKL',
    balance: 523.45,
    status: 'active',
    lastActivity: new Date('2026-04-24T08:45:00Z'),
  },
];

export interface UseAccountStateReturn {
  accounts: AccountData[];
  currentAccount: AccountData | null;
  setCurrentAccount: (account: AccountData) => void;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useAccountState(): UseAccountStateReturn {
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [currentAccount, setCurrentAccountState] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const getStoredAccount = useCallback((): AccountData | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          parsed &&
          parsed.address &&
          parsed.balance !== undefined &&
          parsed.status &&
          parsed.lastActivity
        ) {
          return {
            ...parsed,
            lastActivity: new Date(parsed.lastActivity),
          };
        }
      }
    } catch {
      // localStorage not available or corrupted data
    }
    return null;
  }, []);

  const saveAccount = useCallback((account: AccountData | null) => {
    try {
      if (account) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // localStorage not available
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 300));
      setAccounts(MOCK_ACCOUNTS);

      // Set current account from storage or default to first account
      const storedAccount = getStoredAccount();
      if (storedAccount) {
        const foundAccount = MOCK_ACCOUNTS.find((acc) => acc.address === storedAccount.address);
        if (foundAccount) {
          setCurrentAccountState(foundAccount);
        } else {
          setCurrentAccountState(MOCK_ACCOUNTS[0]);
        }
      } else {
        setCurrentAccountState(MOCK_ACCOUNTS[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch accounts'));
    } finally {
      setLoading(false);
    }
  }, [getStoredAccount]);

  const setCurrentAccount = useCallback(
    (account: AccountData) => {
      setCurrentAccountState(account);
      saveAccount(account);
    },
    [saveAccount]
  );

  const refetch = useCallback(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  return {
    accounts,
    currentAccount,
    setCurrentAccount,
    loading,
    error,
    refetch,
  };
}
