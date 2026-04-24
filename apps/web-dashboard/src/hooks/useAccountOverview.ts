import { useState, useEffect, useCallback } from 'react';

export type AccountStatus = 'active' | 'inactive' | 'locked';

export interface AccountOverview {
  balance: number;
  nonce: number;
  status: AccountStatus;
}

export interface UseAccountOverviewReturn {
  data: AccountOverview | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch account overview metrics (balance, nonce, status).
 * In production, this would use @ancore/core-sdk to query the Stellar network.
 */
export function useAccountOverview(publicKey: string): UseAccountOverviewReturn {
  const [data, setData] = useState<AccountOverview | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!publicKey) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Mock data - in a real app, this would be a multi-call or aggregate query
      const mockData: AccountOverview = {
        balance: 1250.75,
        nonce: 42,
        status: 'active',
      };

      // Simulate partial/missing data edge cases if needed for testing
      // (Though the hook itself should probably return consistent types)
      
      setData(mockData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch account data'));
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
