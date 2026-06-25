import React from 'react';
import { AccountSummary } from '../components/AccountSummary';
import { TransactionList } from '../components/TransactionList';
import { AccountOverviewGrid } from '../widgets/AccountOverviewGrid';
import { useAccountData } from '../hooks/useAccountData';
import { useIndexerActivity } from '../hooks/useIndexerActivity';
import { DashboardPageSkeleton } from '../components/LoadingSkeletons';
import {
  AccountNotFoundError,
  HorizonUnavailableError,
  useAccountOverview,
} from '../hooks/useAccountOverview';

const DEFAULT_ADDRESS = 'GABC...XYZ';

const AccountFetchAlert: React.FC<{
  error: Error;
  onRetry: () => Promise<void>;
  retrying: boolean;
}> = ({ error, onRetry, retrying }) => {
  let title = 'Unable to load account overview';
  let message = 'Try again in a moment.';

  if (error instanceof AccountNotFoundError) {
    title = 'Account not found';
    message = 'This account does not exist on the selected network.';
  } else if (error instanceof HorizonUnavailableError) {
    title = 'Horizon is unavailable';
    message = 'The Stellar Horizon service is temporarily unavailable. Please retry shortly.';
  }

  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-red-800">{message}</p>
        </div>
        <button
          type="button"
          onClick={() => void onRetry()}
          disabled={retrying}
          className="rounded-md border border-red-300 bg-white px-3 py-1.5 font-medium text-red-900 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {retrying ? 'Retrying...' : 'Retry'}
        </button>
      </div>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const { account, loading: accountLoading, error: accountError } = useAccountData(DEFAULT_ADDRESS);
  const {
    error: overviewError,
    refetch: refetchOverview,
    isLoading: overviewLoading,
  } = useAccountOverview(DEFAULT_ADDRESS);
  const {
    items: transactions,
    loading: txLoading,
    error: txError,
    loadMore,
    hasMore,
  } = useIndexerActivity(DEFAULT_ADDRESS);

  const loading = accountLoading || txLoading;
  const error = accountError || txError;

  if (loading) return <DashboardPageSkeleton />;
  if (error) return <p className="text-destructive">Error: {error.message}</p>;
  if (!account) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      {overviewError && (
        <AccountFetchAlert
          error={overviewError}
          onRetry={refetchOverview}
          retrying={overviewLoading}
        />
      )}
      <AccountOverviewGrid publicKey={account.address} />
      <AccountSummary account={account} />
      <TransactionList transactions={transactions} />
      {hasMore && (
        <div className="flex justify-center">
          <button
            onClick={loadMore}
            disabled={txLoading}
            className="px-4 py-2 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            {txLoading ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
};
