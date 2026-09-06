import * as React from 'react';
import {
  BrowserRouter,
  HashRouter,
  Link,
  MemoryRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Clock3,
  History,
  KeyRound,
  Lock,
  PlusCircle,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NotificationProvider } from '@ancore/ui-kit';
import {
  AuthGuard,
  ExtensionAuthProvider,
  PublicOnlyGuard,
  UnlockVerifier,
  useExtensionAuth,
} from './AuthGuard';
import { OnboardingFlow } from '../screens/Onboarding/OnboardingFlow';
import { DeployTestScreen } from '../screens/Onboarding/DeployTestScreen';
import { SignTransactionApprovalScreen } from '../screens/SignTransactionApprovalScreen';
import { NavBar } from '../components/Navigation/NavBar';
import { ReceiveScreen as ReceiveScreenComponent } from '../screens/ReceiveScreen';
import { SettingsScreen } from '../screens/Settings/SettingsScreen';
import { SendScreen as SendFlowScreen } from '../screens/Send/SendScreen';
import { ScheduledTransfersScreen } from '../screens/ScheduledTransfers/ScheduledTransfersScreen';
import { SessionKeysScreen } from '../screens/SessionKeys/SessionKeysScreen';
import { TransactionDetail, type TransactionDetailData } from '../screens/TransactionDetail';
import type { StellarNetwork } from '../utils/explorer-links';
import { useDashboardSettingsStore } from '../state/dashboard-settings';
import { useTelemetrySettingsSync } from '../hooks/useTelemetrySettingsSync';
import { EmptyTransactions } from '../components/EmptyTransactions';
import { ErrorBoundary } from '../components/ErrorBoundary/ErrorBoundary';
import { useAccountStore } from '../stores/account';
import { resolveIndexerUrl } from '../config/urls';
import { createIndexerActivityAdapter } from '../adapters/indexerActivityAdapter';
import type { IndexerActivityRecord } from '../adapters/indexerActivityAdapter';

const APP_TITLE = 'Ancore Extension';

const pageTitles: Record<string, string> = {
  '/unlock': 'Unlock Wallet',
  '/welcome': 'Welcome',
  '/onboarding': 'Create Wallet',
  '/home': 'Home',
  '/send': 'Send',
  '/scheduled': 'Scheduled Transfers',
  '/receive': 'Receive',
  '/history': 'History',
  '/settings': 'Settings',
  '/session-keys': 'Session Keys',
  '/sign-transaction': 'Sign Transaction',
};

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/history/')) {
    return 'Transaction Detail';
  }
  return pageTitles[pathname] ?? 'Page Not Found';
}

function TitleSync() {
  const location = useLocation();

  React.useEffect(() => {
    document.title = `${getPageTitle(location.pathname)} | ${APP_TITLE}`;
  }, [location.pathname]);

  return null;
}

function PopupFrame({ children }: { children: React.ReactNode }) {
  const displayPreference = useDashboardSettingsStore((state) => state.displayPreference);

  return (
    <div
      className={`mx-auto min-h-screen w-[360px] bg-background text-foreground ${displayPreference === 'compact' ? 'text-[13px]' : ''}`.trim()}
      data-display-preference={displayPreference}
    >
      {children}
    </div>
  );
}

function RootRedirect() {
  const { authState, isUnlocked } = useExtensionAuth();

  if (!authState.hasOnboarded) {
    return <Navigate replace to="/onboarding" />;
  }

  return <Navigate replace to={isUnlocked ? '/home' : '/unlock'} />;
}

function ProtectedLayout() {
  const location = useLocation();
  const isImmersiveRoute =
    ['/send', '/receive', '/sign-transaction', '/session-keys'].includes(location.pathname) ||
    location.pathname.startsWith('/history/');

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
      {!isImmersiveRoute && <NavBar />}
    </div>
  );
}

function PageScaffold({
  eyebrow,
  title,
  description,
  children,
  backTo,
  rightAction,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children: React.ReactNode;
  backTo?: string;
  rightAction?: React.ReactNode;
}) {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="px-5 pb-4 pt-5">
        {backTo || rightAction ? (
          <div className="mb-6 flex items-center justify-between">
            {backTo ? (
              <button
                aria-label="Go back"
                className="wallet-icon-btn h-9 w-9 bg-card"
                onClick={() => navigate(backTo)}
                type="button"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : (
              <span />
            )}
            {rightAction}
          </div>
        ) : null}
        {eyebrow ? <p className="wallet-kicker">{eyebrow}</p> : null}
        <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.03em]">{title}</h1>
        <p className="mt-1.5 max-w-[310px] text-[13px] leading-5 text-muted-foreground">
          {description}
        </p>
      </header>
      <main className="flex-1 space-y-3 px-4 pb-5 pt-2">{children}</main>
    </div>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="wallet-card">
      <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
      {description ? (
        <p className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-muted-foreground">
          {description}
        </p>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

function PrimaryButton({
  className,
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={['wallet-pill-btn h-12', className ?? ''].join(' ')}
      type={type}
    />
  );
}

function SecondaryLink({
  to,
  children,
  icon: Icon,
}: {
  to: string;
  children: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <Link
      className="group flex min-h-[82px] flex-col justify-between rounded-[18px] border border-border/70 bg-card p-3.5 text-left active:scale-[0.98]"
      to={to}
    >
      {Icon ? (
        <>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <Icon className="h-4 w-4" strokeWidth={2.2} />
          </span>
          <span className="mt-3 text-[13px] font-medium text-foreground">{children}</span>
        </>
      ) : (
        <span className="m-auto text-[13px] font-medium text-foreground">{children}</span>
      )}
    </Link>
  );
}

function UnlockScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { authState, unlockError, unlockWallet, resetWallet } = useExtensionAuth();
  const [password, setPassword] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const from = (location.state as { from?: string } | null)?.from ?? '/home';

  async function handleUnlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const didUnlock = await unlockWallet(password);
      if (didUnlock) {
        navigate(from, { replace: true });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageScaffold
      eyebrow="Welcome back"
      title="Unlock wallet"
      description="Enter your password to continue securely."
    >
      <div className="mb-2 flex justify-center py-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lock className="h-7 w-7" strokeWidth={1.8} />
        </div>
      </div>
      <Card title={authState.walletName} description={authState.accountAddress}>
        <form className="space-y-4" onSubmit={handleUnlock}>
          <label className="block text-sm font-medium text-foreground">
            Password
            <input
              className="mt-2 h-12 w-full rounded-[14px] border border-border bg-[hsl(var(--surface-sunken))] px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/70 focus:ring-2 focus:ring-primary/10"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              type="password"
              value={password}
            />
          </label>
          {unlockError ? (
            <p
              className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600"
              role="alert"
            >
              {unlockError}
            </p>
          ) : null}
          <PrimaryButton disabled={isSubmitting || !password.trim()} type="submit">
            {isSubmitting ? 'Unlocking…' : 'Unlock'}
          </PrimaryButton>
        </form>
      </Card>
    </PageScaffold>
  );
}

function HomeScreen() {
  const { authState, lockWallet } = useExtensionAuth();
  const network = useDashboardSettingsStore((state) => state.network);

  return (
    <PageScaffold
      eyebrow="Portfolio"
      title="Your wallet"
      description="Everything you need, without the noise."
      rightAction={
        <button
          aria-label="Lock wallet"
          className="wallet-icon-btn h-9 w-9 bg-card"
          onClick={lockWallet}
          type="button"
        >
          <Lock className="h-4 w-4" />
        </button>
      }
    >
      <section className="overflow-hidden rounded-[22px] border border-primary/15 bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-foreground">
              <Wallet className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[13px] font-medium text-foreground">{authState.walletName}</p>
              <p className="text-[11px] text-muted-foreground">Smart account</p>
            </div>
          </div>
          <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            {network}
          </span>
        </div>
        <div className="mt-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Available balance
          </p>
          <p className="mt-2 text-[34px] font-semibold leading-none tracking-[-0.04em] text-foreground">
            1,245.80 <span className="text-[17px] font-medium text-muted-foreground">XLM</span>
          </p>
          <p className="wallet-address mt-4">{authState.accountAddress}</p>
        </div>
      </section>
      <div className="grid grid-cols-2 gap-3">
        <SecondaryLink to="/send" icon={ArrowUpRight}>
          Send
        </SecondaryLink>
        <SecondaryLink to="/receive" icon={ArrowDownLeft}>
          Receive
        </SecondaryLink>
        <SecondaryLink to="/scheduled" icon={Clock3}>
          Scheduled
        </SecondaryLink>
        <SecondaryLink to="/history" icon={History}>
          Activity
        </SecondaryLink>
        <SecondaryLink to="/session-keys" icon={KeyRound}>
          Session keys
        </SecondaryLink>
      </div>
      {import.meta.env.DEV && (
        <button
          className="mt-2 w-full rounded-[14px] border border-dashed border-border px-4 py-3 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
          onClick={() => chrome.runtime.sendMessage({ type: 'DEV_OPEN_APPROVAL' })}
          type="button"
        >
          Test side panel sign
        </button>
      )}
    </PageScaffold>
  );
}

function SendScreenRoute() {
  return <SendFlowScreen />;
}

function ScheduledTransfersRoute() {
  return (
    <PageScaffold
      eyebrow="Payments"
      title="Scheduled Transfers"
      description="Pause, cancel, and review execution outcomes for scheduled jobs."
    >
      <ScheduledTransfersScreen />
    </PageScaffold>
  );
}

function ReceiveScreen() {
  const network = useDashboardSettingsStore((state) => state.network);
  const { authState } = useExtensionAuth();

  return (
    <ReceiveScreenComponent
      smartAccountId={authState.smartAccountId}
      ownerPublicKey={
        authState.accountAddress !== 'GCFX...WALLET' ? authState.accountAddress : null
      }
      network={network}
      walletName={authState.walletName}
      onBack={() => window.history.back()}
    />
  );
}

export type HistoryFilter = 'all' | 'sent' | 'received' | 'failed';

export type HistoryEntry = {
  id: string;
  label: string;
  amount: string;
  date: string;
  kind: Exclude<HistoryFilter, 'all'>;
  status: 'confirmed' | 'failed';
};

const HISTORY_FILTERS: Array<{ value: HistoryFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'sent', label: 'Sent' },
  { value: 'received', label: 'Received' },
  { value: 'failed', label: 'Failed' },
];

// ---------------------------------------------------------------------------
// Indexer data → HistoryEntry mapping helpers
// ---------------------------------------------------------------------------

function shortenAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function humanizeActivityType(activityType: string): string {
  switch (activityType) {
    case 'payment':
      return 'Payment';
    case 'transfer':
      return 'Transfer';
    case 'contract_invocation':
      return 'Contract interaction';
    case 'contract_call':
      return 'Contract call';
    case 'smart_account_execute':
      return 'Smart account execute';
    case 'liquidity_pool':
      return 'Liquidity pool';
    default:
      return activityType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function formatActivityDate(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function mapActivityToEntry(activity: IndexerActivityRecord, accountId: string): HistoryEntry {
  const isIncoming = activity.activity_type === 'payment' && activity.counterparty !== accountId;
  const isPayment = activity.activity_type === 'payment';

  const kind: HistoryEntry['kind'] = isIncoming ? 'received' : 'sent';
  const sign = isIncoming ? '+' : '-';
  const asset = activity.asset ?? 'XLM';
  const amount = activity.amount ?? '0';

  let label: string;
  if (isIncoming && activity.counterparty) {
    label = `Received from ${shortenAddress(activity.counterparty)}`;
  } else if (isPayment && activity.counterparty) {
    label = `Sent to ${shortenAddress(activity.counterparty)}`;
  } else if (isIncoming) {
    label = 'Received';
  } else {
    label = humanizeActivityType(activity.activity_type);
  }

  return {
    id: activity.id,
    label,
    amount: `${sign}${amount} ${asset}`,
    date: formatActivityDate(activity.created_at),
    kind,
    status: 'confirmed',
  };
}

// ---------------------------------------------------------------------------
// Hook: paginated transaction history from the indexer
// ---------------------------------------------------------------------------

function useTransactionHistory() {
  const { filter, setFilter } = useHistoryFilter();
  const environment = useDashboardSettingsStore((s) => s.environment);
  const { accounts, activeAccountId } = useAccountStore();

  const smartAccountId = React.useMemo(() => {
    if (!activeAccountId && accounts.length === 0) return null;
    const active = accounts.find((a) => a.id === activeAccountId) ?? accounts[0];
    return active?.contractId ?? null;
  }, [accounts, activeAccountId]);

  const indexerUrl = React.useMemo(() => {
    if (!smartAccountId) return null;
    return resolveIndexerUrl(environment);
  }, [smartAccountId, environment]);

  const adapter = React.useMemo(() => {
    if (!smartAccountId || !indexerUrl) return null;
    return createIndexerActivityAdapter(indexerUrl, smartAccountId);
  }, [smartAccountId, indexerUrl]);

  const [rawItems, setRawItems] = React.useState<IndexerActivityRecord[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (!adapter) {
      setRawItems([]);
      setNextCursor(null);
      setInitialLoading(false);
      return;
    }

    let cancelled = false;
    setInitialLoading(true);
    setError(null);

    adapter
      .fetchTransactionPage({ cursor: null, pageSize: 20 })
      .then((page) => {
        if (!cancelled) {
          setRawItems(page.transactions);
          setNextCursor(page.nextCursor);
          setInitialLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setInitialLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [adapter]);

  const loadMore = React.useCallback(async () => {
    if (!adapter || !nextCursor || loadingMore) return;

    setLoadingMore(true);
    try {
      const page = await adapter.fetchTransactionPage({
        cursor: nextCursor,
        pageSize: 20,
      });
      setRawItems((prev) => [...prev, ...page.transactions]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoadingMore(false);
    }
  }, [adapter, nextCursor, loadingMore]);

  const hasMore = nextCursor !== null;

  const entries = React.useMemo(() => {
    if (!smartAccountId) return [];
    return filterHistoryEntries(
      rawItems.map((r) => mapActivityToEntry(r, smartAccountId)),
      filter
    );
  }, [rawItems, filter, smartAccountId]);

  return {
    entries,
    isLoading: initialLoading,
    isLoadingMore: loadingMore,
    error,
    hasMore,
    loadMore,
    activeFilter: filter,
    setFilter,
    smartAccountId,
  };
}

function isHistoryFilter(value: string | null): value is HistoryFilter {
  return value === 'all' || value === 'sent' || value === 'received' || value === 'failed';
}

export function filterHistoryEntries(entries: HistoryEntry[], filter: HistoryFilter) {
  return entries.filter((entry) => {
    if (filter === 'all') {
      return true;
    }
    return entry.kind === filter;
  });
}

function useHistoryFilter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = searchParams.get('filter');
  const filter: HistoryFilter = isHistoryFilter(filterParam) ? filterParam : 'all';

  const setFilter = (nextFilter: HistoryFilter) => {
    const nextParams = new URLSearchParams(searchParams);
    if (nextFilter === 'all') {
      nextParams.delete('filter');
    } else {
      nextParams.set('filter', nextFilter);
    }
    setSearchParams(nextParams, { replace: true });
  };

  return { filter, setFilter };
}

export function HistoryActivityList({
  activeFilter,
  entries,
  onFilterChange,
  onReceive,
  onSelectEntry,
}: {
  activeFilter: HistoryFilter;
  entries: HistoryEntry[];
  onFilterChange: (filter: HistoryFilter) => void;
  onReceive?: () => void;
  onSelectEntry?: (entry: HistoryEntry) => void;
}) {
  return (
    <Card title="Recent activity">
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Transaction filters">
        {HISTORY_FILTERS.map((option) => {
          const isActive = option.value === activeFilter;
          return (
            <button
              key={option.value}
              aria-pressed={isActive}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                isActive
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
              onClick={() => onFilterChange(option.value)}
              type="button"
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {entries.length === 0 ? (
        <EmptyTransactions
          variant={activeFilter}
          onReceive={onReceive}
          onResetFilter={() => onFilterChange('all')}
        />
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              role={onSelectEntry ? 'button' : undefined}
              tabIndex={onSelectEntry ? 0 : undefined}
              onClick={() => onSelectEntry?.(entry)}
              onKeyDown={(e) => {
                if (onSelectEntry && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onSelectEntry(entry);
                }
              }}
              className={`flex items-center justify-between rounded-xl border border-border px-4 py-3 ${
                onSelectEntry
                  ? 'cursor-pointer transition hover:border-primary/40 hover:bg-accent/40'
                  : ''
              }`}
            >
              <div>
                <p className="text-sm font-medium text-foreground">{entry.label}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.date} • {entry.status}
                </p>
              </div>
              <span className="text-sm font-semibold text-foreground">{entry.amount}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function TransactionDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const network = useDashboardSettingsStore((state) => state.network);
  const { authState } = useExtensionAuth();

  const stateTx = (location.state as { transaction?: TransactionDetailData } | null)?.transaction;

  const transaction: TransactionDetailData = React.useMemo(() => {
    if (stateTx) {
      return {
        ...stateTx,
        network: stateTx.network ?? (network as StellarNetwork),
      };
    }

    return {
      id: id ?? 'unknown',
      status: 'confirmed',
      type: 'sent',
      from: authState.accountAddress || 'Self',
      to: 'Recipient',
      amount: '0',
      assetCode: 'XLM',
      fee: '0.00001 XLM',
      memo: null,
      timestamp: new Date().toISOString(),
      blockNumber: null,
      hash: id ?? 'TX-HASH',
      network: network as StellarNetwork,
    };
  }, [stateTx, id, network, authState.accountAddress]);

  return (
    <div className="p-4">
      <TransactionDetail transaction={transaction} onBack={() => navigate('/history')} />
    </div>
  );
}

function HistoryScreen() {
  const navigate = useNavigate();
  const {
    entries,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    activeFilter,
    setFilter,
    smartAccountId,
  } = useTransactionHistory();

  const handleSelectEntry = (entry: HistoryEntry) => {
    const detailData: TransactionDetailData = {
      id: entry.id,
      status: entry.status === 'failed' ? 'failed' : 'confirmed',
      type: entry.kind === 'received' ? 'received' : 'sent',
      from: entry.kind === 'received' ? entry.label.replace(/^Received from\s+/i, '') : 'Self',
      to: entry.kind === 'sent' ? entry.label.replace(/^Sent to\s+/i, '') : 'Recipient',
      amount: entry.amount.replace(/^[+-]/, '').split(' ')[0] ?? '0',
      assetCode: entry.amount.split(' ')[1] ?? 'XLM',
      fee: '0.00001 XLM',
      memo: null,
      timestamp: new Date().toISOString(),
      blockNumber: null,
      hash: entry.id,
    };
    navigate(`/history/${entry.id}`, { state: { transaction: detailData } });
  };

  if (!smartAccountId) {
    return (
      <PageScaffold
        eyebrow="Activity"
        title="History"
        description="Filter recent transaction activity by sent, received, or failed status."
      >
        <EmptyTransactions
          variant="all"
          message="No account configured"
          description="Set up a smart account to view transaction history."
        />
      </PageScaffold>
    );
  }

  if (error && entries.length === 0) {
    return (
      <PageScaffold
        eyebrow="Activity"
        title="History"
        description="Filter recent transaction activity by sent, received, or failed status."
      >
        <Card title="Unable to load history">
          <p className="text-sm text-muted-foreground">
            {error.message || 'Could not load transaction history.'}
          </p>
          <PrimaryButton className="mt-3" onClick={() => window.location.reload()}>
            Retry
          </PrimaryButton>
        </Card>
      </PageScaffold>
    );
  }

  return (
    <PageScaffold
      eyebrow="Activity"
      title="History"
      description="Filter recent transaction activity by sent, received, or failed status."
    >
      {isLoading ? (
        <Card title="Recent activity">
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </Card>
      ) : (
        <>
          <HistoryActivityList
            activeFilter={activeFilter}
            entries={entries}
            onFilterChange={setFilter}
            onSelectEntry={handleSelectEntry}
          />
          {hasMore && (
            <button
              type="button"
              className="mt-2 inline-flex w-full items-center justify-center rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-accent disabled:opacity-50"
              disabled={isLoadingMore}
              onClick={loadMore}
            >
              {isLoadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </PageScaffold>
  );
}

function NotFoundScreen() {
  const { authState, isUnlocked } = useExtensionAuth();
  const fallbackPath = !authState.hasOnboarded ? '/onboarding' : isUnlocked ? '/home' : '/unlock';

  return (
    <PageScaffold
      eyebrow="Routing"
      title="404"
      description="The requested popup route does not exist."
      backTo={fallbackPath}
    >
      <Card title="Route not found" description="Use the button below to recover to a known route.">
        <SecondaryLink to={fallbackPath}>Go back to safety</SecondaryLink>
      </Card>
    </PageScaffold>
  );
}

function TelemetrySettingsSync() {
  useTelemetrySettingsSync();
  return null;
}

export function ExtensionRouterContent() {
  const navigate = useNavigate();

  return (
    <PopupFrame>
      <TelemetrySettingsSync />
      <TitleSync />
      <ErrorBoundary
        onGoHome={() => navigate('/home', { replace: true })}
        onGoToSettings={() => navigate('/settings', { replace: true })}
      >
        <Routes>
          <Route element={<RootRedirect />} path="/" />
          {/* /welcome redirects into the real onboarding flow */}
          <Route path="/welcome" element={<Navigate replace to="/onboarding" />} />
          <Route
            element={
              <PublicOnlyGuard mode="onboarding">
                <OnboardingFlow />
              </PublicOnlyGuard>
            }
            path="/onboarding/*"
          />

          {/* Smart-account deploy harness (#768) — dev only, excluded from prod build */}
          {import.meta.env.DEV && <Route element={<DeployTestScreen />} path="/deploy-test" />}
          <Route
            element={
              <PublicOnlyGuard mode="unlock">
                <UnlockScreen />
              </PublicOnlyGuard>
            }
            path="/unlock"
          />
          <Route element={<AuthGuard />}>
            <Route element={<ProtectedLayout />}>
              <Route element={<HomeScreen />} path="/home" />
              <Route element={<SendScreenRoute />} path="/send" />
              <Route element={<ScheduledTransfersRoute />} path="/scheduled" />
              <Route element={<ReceiveScreen />} path="/receive" />
              <Route element={<HistoryScreen />} path="/history" />
              <Route element={<TransactionDetailRoute />} path="/history/:id" />
              <Route element={<SettingsScreen />} path="/settings" />
              <Route element={<SessionKeysScreen />} path="/session-keys" />
            </Route>
          </Route>
          <Route element={<SignTransactionApprovalScreen />} path="/sign-transaction" />
          <Route element={<NotFoundScreen />} path="*" />
        </Routes>
      </ErrorBoundary>
    </PopupFrame>
  );
}

export function ExtensionRouter() {
  // Vite multi-page dev serves the popup at /src/popup/index.html, so path-based
  // BrowserRouter would 404 every app route. HashRouter works in browser preview;
  // real extension popup still works (hash or path both fine for in-popup nav).
  const Router = import.meta.env.DEV ? HashRouter : BrowserRouter;

  return (
    <Router>
      <NotificationProvider>
        <ExtensionAuthProvider>
          <ExtensionRouterContent />
        </ExtensionAuthProvider>
      </NotificationProvider>
    </Router>
  );
}

export function ExtensionRouterTestHarness({
  initialEntries,
  unlockVerifier,
  initiallyUnlocked,
}: {
  initialEntries: string[];
  unlockVerifier?: UnlockVerifier;
  initiallyUnlocked?: boolean;
}) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <NotificationProvider>
        <ExtensionAuthProvider
          unlockVerifier={unlockVerifier}
          initiallyUnlocked={initiallyUnlocked}
        >
          <ExtensionRouterContent />
        </ExtensionAuthProvider>
      </NotificationProvider>
    </MemoryRouter>
  );
}
