import React from 'react';
import { useAccountOverview } from '../hooks/useAccountOverview';
import { BalanceWidget, NonceWidget, AccountStatusWidget } from './AccountWidgets';
import { WidgetErrorBoundary } from './WidgetErrorBoundary';

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
      <WidgetErrorBoundary>
        <BalanceWidget balance={data?.balance} isLoading={isLoading} error={error} />
      </WidgetErrorBoundary>
      <WidgetErrorBoundary>
        <NonceWidget nonce={data?.nonce} isLoading={isLoading} error={error} />
      </WidgetErrorBoundary>
      <WidgetErrorBoundary>
        <AccountStatusWidget status={data?.status} isLoading={isLoading} error={error} />
      </WidgetErrorBoundary>
    </div>
  );
};

export default AccountOverviewGrid;
