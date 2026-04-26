import React from 'react';
import { useParams } from 'react-router-dom';
import { AccountSummary } from '../components/AccountSummary';
import { TransactionList } from '../components/TransactionList';
import { useAccountData } from '../hooks/useAccountData';

export const Account: React.FC = () => {
  const { address = '' } = useParams<{ address: string }>();
  const { account, transactions, loading, error } = useAccountData(address);

  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (error)   return <p className="text-destructive">Error: {error.message}</p>;
  if (!account) return <p className="text-muted-foreground">Account not found.</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Account</h1>
      <AccountSummary account={account} />
      <TransactionList transactions={transactions} />
    </div>
  );
};
