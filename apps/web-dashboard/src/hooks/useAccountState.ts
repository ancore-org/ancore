import { useState, useEffect, useCallback, useRef } from 'react';
import type { AccountData } from '../types/dashboard';
import { useWalletConnection } from './useWalletConnection';

const STORAGE_KEY = 'ancore-dashboard-selected-account';

interface AccountOverviewResponse {
  balance: number;
  status: 'active' | 'inactive' | 'locked';
}

export interface UseAccountStateReturn {
  accounts: AccountData[];
  currentAccount: AccountData | null;
  setCurrentAccount: (account: AccountData) => void;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Drives the app-wide account switcher off the real connected wallet
 * (@ancore/wallet-api via useWalletConnection) instead of a fake account
 * list. The extension currently exposes a single active account per
 * connection, so `accounts` holds at most one real entry.
 */
export function useAccountState(): UseAccountStateReturn {
  const wallet = useWalletConnection();
  const address = wallet.smartAccountId ?? wallet.ownerPublicKey ?? null;

  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [currentAccount, setCurrentAccountState] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

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
    if (!mountedRef.current) {
      return;
    }

    if (!address) {
      setAccounts([]);
      setCurrentAccountState(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/account-overview?publicKey=${encodeURIComponent(address)}`
      );
      if (!mountedRef.current) {
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch account overview');
      }

      const payload = (await response.json()) as AccountOverviewResponse;
      const account: AccountData = {
        address,
        balance: payload.balance,
        status: payload.status === 'active' ? 'active' : 'inactive',
        lastActivity: new Date(),
      };

      setAccounts([account]);
      setCurrentAccountState(account);
      saveAccount(account);
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to fetch accounts'));
        setAccounts([]);
        setCurrentAccountState(null);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [address, saveAccount]);

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
    mountedRef.current = true;
    fetchAccounts();

    return () => {
      mountedRef.current = false;
    };
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
