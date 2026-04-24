import React from 'react';
import { useAccountOverview } from '../hooks/useAccountOverview';
import { BalanceWidget, NonceWidget, AccountStatusWidget } from './AccountWidgets';

interface AccountOverviewGridProps {
  publicKey: string;
}

/**
 * A grid layout containing all account overview widgets.
 * Connects to the useAccountOverview hook for data fetching.
 */
export const AccountOverviewGrid: React.FC<AccountOverviewGridProps> = ({ publicKey }) => {
  const { data, isLoading, error } = useAccountOverview(publicKey);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <BalanceWidget 
        balance={data?.balance} 
        isLoading={isLoading} 
        error={error} 
      />
      <NonceWidget 
        nonce={data?.nonce} 
        isLoading={isLoading} 
        error={error} 
      />
      <AccountStatusWidget 
        status={data?.status} 
        isLoading={isLoading} 
        error={error} 
      />
    </div>
  );
};

export default AccountOverviewGrid;
