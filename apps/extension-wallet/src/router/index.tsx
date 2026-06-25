import * as React from 'react';
import {
  BrowserRouter,
  Link,
  MemoryRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { ArrowLeft, Lock, PlusCircle } from 'lucide-react';
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
import { useDashboardSettingsStore } from '../state/dashboard-settings';
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
      className={`mx-auto min-h-screen w-[360px] bg-background text-foreground shadow-xl ${displayPreference === 'compact' ? 'text-[13px]' : ''}`.trim()}
      data-display-preference={displayPreference}
    >
      {children}
    </div>
  );
}

function RootRedirect() {
  const { authState } = useExtensionAuth();

  if (!authState.hasOnboarded) {
    return <Navigate replace to="/onboarding" />;
  }

  return <Navigate replace to={authState.isUnlocked ? '/home' : '/unlock'} />;
}

function ProtectedLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
      <NavBar />
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
      <header className="bg-gradient-to-br from-primary to-purple-800 px-5 pb-7 pt-8 text-white">
        <div className="flex items-center justify-between">
          {backTo ? (
            <button
              aria-label="Go back"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              onClick={() => navigate(backTo)}
              type="button"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <span className="h-9 w-9" />
          )}
          {rightAction ?? <span className="h-9 w-9" />}
        </div>
        {eyebrow ? (
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-white/70">{description}</p>
      </header>
      <main className="flex-1 space-y-4 p-4">{children}</main>
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
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
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
      className={[
        'inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50',
        className ?? '',
      ].join(' ')}
      type={type}
    />
  );
}

function SecondaryLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      className="inline-flex w-full items-center justify-center rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-accent"
      to={to}
    >
      {children}
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
      eyebrow="Wallet locked"
      title="Unlock wallet"
      description="Use the local demo unlock flow to exercise protected navigation and route redirects."
    >
      <Card title={authState.walletName} description={`Address: ${authState.accountAddress}`}>
        <form className="space-y-4" onSubmit={handleUnlock}>
          <label className="block text-sm font-medium text-foreground">
            Password
            <input
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none transition focus:border-primary"
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
  const environment = useDashboardSettingsStore((state) => state.environment);

  return (
    <PageScaffold
      eyebrow="Dashboard"
      title="Home"
      description="Your popup landing screen with direct links into the main wallet flows."
      rightAction={
        <button
          aria-label="Lock wallet"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          onClick={lockWallet}
          type="button"
        >
          <Lock className="h-4 w-4" />
        </button>
      }
    >
      <Card
        title={authState.walletName}
        description={`Demo session wallet • ${network} • ${environment}`}
      >
        <div className="rounded-xl bg-accent px-4 py-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Available balance</p>
          <p className="mt-1 text-2xl font-bold text-foreground">1,245.80 XLM</p>
          <p className="mt-1">{authState.accountAddress}</p>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <SecondaryLink to="/send">Send funds</SecondaryLink>
        <SecondaryLink to="/scheduled">Scheduled transfers</SecondaryLink>
        <SecondaryLink to="/receive">Receive funds</SecondaryLink>
        <SecondaryLink to="/history">View history</SecondaryLink>
        <SecondaryLink to="/session-keys">Session keys</SecondaryLink>
      </div>
      {import.meta.env.DEV && (
        <button
          className="mt-4 w-full rounded-xl border border-dashed border-yellow-500/50 px-4 py-3 text-sm font-semibold text-yellow-600 transition hover:bg-yellow-500/10"
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
  return (
    <PageScaffold
      eyebrow="Payments"
      title="Send"
      description="Send now or schedule a one-time or recurring transfer."
    >
      <SendFlowScreen />
    </PageScaffold>
  );
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
}: {
  activeFilter: HistoryFilter;
  entries: HistoryEntry[];
  onFilterChange: (filter: HistoryFilter) => void;
  onReceive?: () => void;
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
              className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
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

function HistoryScreen() {
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
  const { authState } = useExtensionAuth();
  const fallbackPath = !authState.hasOnboarded
    ? '/onboarding'
    : authState.isUnlocked
      ? '/home'
      : '/unlock';

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

export function ExtensionRouterContent() {
  const navigate = useNavigate();

  return (
    <PopupFrame>
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
  return (
    <BrowserRouter>
      <NotificationProvider>
        <ExtensionAuthProvider>
          <ExtensionRouterContent />
        </ExtensionAuthProvider>
      </NotificationProvider>
    </BrowserRouter>
  );
}

export function ExtensionRouterTestHarness({
  initialEntries,
  unlockVerifier,
}: {
  initialEntries: string[];
  unlockVerifier?: UnlockVerifier;
}) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <NotificationProvider>
        <ExtensionAuthProvider unlockVerifier={unlockVerifier}>
          <ExtensionRouterContent />
        </ExtensionAuthProvider>
      </NotificationProvider>
    </MemoryRouter>
  );
}
