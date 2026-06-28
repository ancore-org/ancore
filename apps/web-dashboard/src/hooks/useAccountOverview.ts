import { useState, useEffect, useCallback } from 'react';

export type AccountStatus = 'active' | 'inactive' | 'locked';

export interface AccountOverview {
  balance: number;
  nonce: number;
  status: AccountStatus;
}

export class AccountOverviewError extends Error {
  code: 'ACCOUNT_NOT_FOUND' | 'HORIZON_UNAVAILABLE' | 'FETCH_FAILED';

  constructor(message: string, code: 'ACCOUNT_NOT_FOUND' | 'HORIZON_UNAVAILABLE' | 'FETCH_FAILED') {
    super(message);
    this.name = 'AccountOverviewError';
    this.code = code;
  }
}

export class AccountNotFoundError extends AccountOverviewError {
  constructor() {
    super('Account not found on network', 'ACCOUNT_NOT_FOUND');
    this.name = 'AccountNotFoundError';
  }
}

export class HorizonUnavailableError extends AccountOverviewError {
  constructor() {
    super('Horizon is temporarily unavailable', 'HORIZON_UNAVAILABLE');
    this.name = 'HorizonUnavailableError';
  }
}

export interface UseAccountOverviewReturn {
  data: AccountOverview | null;
  isLoading: boolean;
  error: AccountOverviewError | null;
  refetch: () => Promise<void>;
}

function classifyAccountOverviewError(status?: number): AccountOverviewError {
  if (status === 404) {
    return new AccountNotFoundError();
  }

  if (status && status >= 500) {
    return new HorizonUnavailableError();
  }

  return new AccountOverviewError('Failed to fetch account data', 'FETCH_FAILED');
}

/**
 * Hook to fetch account overview metrics (balance, nonce, status).
 * Uses Horizon API to fetch real Stellar account data.
 */
export function useAccountOverview(publicKey: string): UseAccountOverviewReturn {
  const [data, setData] = useState<AccountOverview | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<AccountOverviewError | null>(null);

  const fetchData = useCallback(async () => {
    if (!publicKey) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/account-overview?publicKey=${encodeURIComponent(publicKey)}`
      );

      if (!response.ok) {
        throw classifyAccountOverviewError(response.status);
      }

      const accountOverview = (await response.json()) as AccountOverview;

      setData(accountOverview);
    } catch (err) {
      setError(
        err instanceof AccountOverviewError
          ? err
          : new AccountOverviewError('Failed to fetch account data', 'FETCH_FAILED')
      );
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}
