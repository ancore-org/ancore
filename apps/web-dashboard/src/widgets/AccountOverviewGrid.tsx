import React from 'react';
import { useAccountOverview } from '../hooks/useAccountOverview';
import { BalanceWidget, NonceWidget, AccountStatusWidget } from './AccountWidgets';
import { WidgetErrorBoundary } from './WidgetErrorBoundary';
import { OnboardingHints } from './OnboardingHints';

interface AccountOverviewGridProps {
  publicKey: string;
}

export const AccountOverviewGrid: React.FC<AccountOverviewGridProps> = ({ publicKey }) => {
  const { data, isLoading, error } = useAccountOverview(publicKey);

  const showOnboardingHints =
    !isLoading && !error && data && data.balance === 0 && data.nonce === 0;

  return (
    <>
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
      {showOnboardingHints && <OnboardingHints />}
    </>
  );
};

export default AccountOverviewGrid;
