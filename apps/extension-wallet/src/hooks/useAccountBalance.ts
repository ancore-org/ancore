import { useState, useEffect, useCallback } from 'react';

interface UseAccountBalanceReturn {
  balance: number;
  isLoading: boolean;
  error: Error | null;
  refreshBalance: () => Promise<void>;
}

/**
 * Hook for fetching and managing account balance
 * In a real application, this would connect to the Stellar network
 * via @ancore/core-sdk and @ancore/stellar packages
 */
export function useAccountBalance(): UseAccountBalanceReturn {
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Simulates fetching balance from the Stellar network
   * In production, this would use:
   * - @ancore/stellar for network connection
   * - @ancore/core-sdk for account abstraction
   * - Proper error handling and retry logic
   */
  const fetchBalance = useCallback(async (): Promise<number> => {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Simulate random network errors (10% chance for demo)
    if (Math.random() < 0.1) {
      throw new Error('Network timeout: Unable to reach Stellar network');
    }

    // In a real app, this would be:
    // const client = new StellarClient({ network: 'testnet' });
    // const account = await client.getAccount(publicKey);
    // return account.balances.find(b => b.asset_type === 'native')?.balance || 0;

    // For demo, return current balance with small random variation
    const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
    return Math.max(0, balance * (1 + variation));
  }, [balance]);

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

  // Initial fetch on mount
  useEffect(() => {
    refreshBalance();
  }, []);

  // Simulate balance updates from network (polling)
  useEffect(() => {
    if (isLoading) return;

    const interval = setInterval(() => {
      // Only update if not currently loading and no error
      if (!isLoading && !error) {
        fetchBalance()
          .then((newBalance) => {
            // Only update if balance changed significantly (> 0.001 XLM)
            if (Math.abs(newBalance - balance) > 0.001) {
              setBalance(newBalance);
            }
          })
          .catch((err) => {
            // Don't set error for background updates, just log
            console.debug('Background balance update failed:', err);
          });
      }
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [balance, isLoading, error, fetchBalance]);

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

/**
 * Utility function to convert XLM to USD (placeholder)
 * In production, this would fetch from a price API
 */
export function convertToUSD(xlmAmount: number, rate: number = 0.12): number {
  return xlmAmount * rate;
}

/**
 * Utility function to format USD value
 */
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default useAccountBalance;
