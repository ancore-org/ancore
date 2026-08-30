import React from 'react';
import { Link } from 'react-router-dom';
import { AccountSummary } from '../components/AccountSummary';
import { TransactionList } from '../components/TransactionList';
import { AccountOverviewGrid } from '../widgets/AccountOverviewGrid';
import { useAccountData } from '../hooks/useAccountData';
import { useAccountState } from '../hooks/useAccountState';
import { useIndexerActivity } from '../hooks/useIndexerActivity';
import { useWalletConnection } from '../hooks/useWalletConnection';
import { DashboardPageSkeleton } from '../components/LoadingSkeletons';
import {
  AccountNotFoundError,
  HorizonUnavailableError,
  useAccountOverview,
} from '../hooks/useAccountOverview';

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
      className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-1">{message}</p>
        </div>
        <button
          type="button"
          onClick={() => void onRetry()}
          disabled={retrying}
          className="rounded-full border border-destructive/30 px-3 py-1.5 font-medium transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {retrying ? 'Retrying...' : 'Retry'}
        </button>
      </div>
    </div>
  );
};

const ConnectWalletPrompt: React.FC<{
  wallet: ReturnType<typeof useWalletConnection>;
}> = ({ wallet }) => (
  <div className="space-y-6">
    <h1 className="text-2xl font-semibold">Dashboard</h1>
    <div className="rounded-2xl border border-border bg-card px-6 py-8 text-center">
      <p className="text-lg font-medium">Connect a wallet to view your dashboard</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {wallet.extensionInstalled
          ? 'Your balance, activity and account overview all load from the connected account.'
          : 'Install the Ancore browser extension to connect an account.'}
      </p>
      {wallet.error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {wallet.error}
        </p>
      )}
      {wallet.extensionInstalled && (
        <button
          type="button"
          onClick={() => void wallet.connect()}
          disabled={wallet.connecting}
          className="mt-5 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {wallet.connecting ? 'Connecting...' : 'Connect wallet'}
        </button>
      )}
    </div>
  </div>
);

export const Dashboard: React.FC = () => {
  // The address every data source on this page keys off. Sourced from the
  // connected wallet, falling back to the account the user selected in the
  // dashboard's own account switcher — the same resolution order
  // ScheduledTransfersPage uses, so the two pages never show different
  // accounts at the same time.
  //
  // This replaced a hardcoded 'GABC...XYZ' constant, which is not even a
  // well-formed 56-character StrKey, so the dashboard's three data sources
  // were all querying an address that cannot exist.
  const wallet = useWalletConnection();
  const { currentAccount } = useAccountState();
  const address = wallet.smartAccountId ?? currentAccount?.address ?? '';

  // All three hooks no-op on an empty address rather than issuing a request,
  // so they are safe to call unconditionally — which they must be, since
  // hooks cannot be called behind a branch.
  const { account, loading: accountLoading, error: accountError } = useAccountData(address);
  const {
    error: overviewError,
    refetch: refetchOverview,
    isLoading: overviewLoading,
  } = useAccountOverview(address);
  const {
    items: transactions,
    loading: txLoading,
    error: txError,
    loadMore,
    hasMore,
  } = useIndexerActivity(address);

  const loading = accountLoading || txLoading;
  const error = accountError || txError;

  // Checked before `loading`: with no address the data hooks return early
  // without clearing their initial loading flag, so the page would otherwise
  // sit on the skeleton forever instead of telling the user to connect.
  if (!address) return <ConnectWalletPrompt wallet={wallet} />;

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
      <TransactionList
        transactions={transactions}
        emptyAction={
          <Link
            to="/dashboard/send"
            className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
          >
            Send your first payment
          </Link>
        }
      />
      {hasMore && (
        <div className="flex justify-center">
          <button
            onClick={loadMore}
            disabled={txLoading}
            className="rounded-full border border-border px-4 py-2 text-sm transition-colors hover:bg-accent disabled:opacity-50"
          >
            {txLoading ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
};
