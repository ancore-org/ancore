import React from 'react';
import { AccountSummary } from '../components/AccountSummary';
import { TransactionList } from '../components/TransactionList';
import { AccountOverviewGrid } from '../widgets/AccountOverviewGrid';
import { useAccountData } from '../hooks/useAccountData';

const DEFAULT_ADDRESS = 'GABC...XYZ';

export const Dashboard: React.FC = () => {
  const { account, transactions, loading, error } = useAccountData(DEFAULT_ADDRESS);

  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (error)   return <p className="text-destructive">Error: {error.message}</p>;
  if (!account) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <AccountOverviewGrid publicKey={account.address} />
      <AccountSummary account={account} />
      <TransactionList transactions={transactions} />
    </div>
  );
};
