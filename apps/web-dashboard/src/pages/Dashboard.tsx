import React from 'react';
import { AccountSummary } from '../components/AccountSummary';
import { TransactionList } from '../components/TransactionList';
import { AccountOverviewGrid } from '../widgets/AccountOverviewGrid';
import { useAccountData } from '../hooks/useAccountData';
import { useIndexerActivity } from '../hooks/useIndexerActivity';
import { DashboardPageSkeleton } from '../components/LoadingSkeletons';

const DEFAULT_ADDRESS = 'GABC...XYZ';

export const Dashboard: React.FC = () => {
  const { account, loading: accountLoading, error: accountError } = useAccountData(DEFAULT_ADDRESS);
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
