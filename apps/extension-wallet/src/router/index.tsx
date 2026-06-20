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
import { NavBar } from '../components/Navigation/NavBar';
import { ReceiveScreen as ReceiveScreenComponent } from '../screens/ReceiveScreen';
import { SettingsScreen } from '../screens/Settings/SettingsScreen';
import { SendScreen as SendFlowScreen } from '../screens/Send/SendScreen';
import { ScheduledTransfersScreen } from '../screens/ScheduledTransfers/ScheduledTransfersScreen';
import { useDashboardSettingsStore } from '../state/dashboard-settings';
import { EmptyTransactions } from '../components/EmptyTransactions';
import { ErrorBoundary } from '../components/ErrorBoundary/ErrorBoundary';

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

// Demo CreateAccountScreen preserved only for local development with VITE_DEMO_ROUTER=true
function DemoCreateAccountScreen() {
  const navigate = useNavigate();
  const { completeOnboarding } = useExtensionAuth();
  const [walletName, setWalletName] = React.useState('My Ancore Wallet');

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    completeOnboarding(walletName);
    navigate('/home', { replace: true });
  }

  return (
    <PageScaffold
      backTo="/welcome"
      eyebrow="Demo only"
      title="Create account (demo)"
      description="This demo path is only available in development with VITE_DEMO_ROUTER=true."
    >
      <Card title="Wallet profile" description="Pick a name for the local demo wallet session.">
        <form className="space-y-4" onSubmit={handleCreate}>
          <label className="block text-sm font-medium text-foreground">
            Wallet name
            <input
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none ring-0 transition focus:border-primary"
              onChange={(event) => setWalletName(event.target.value)}
              placeholder="My Ancore Wallet"
              value={walletName}
            />
          </label>
          <PrimaryButton type="submit">Create wallet (demo)</PrimaryButton>
        </form>
      </Card>
    </PageScaffold>
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
          ) : null}
          <PrimaryButton disabled={isSubmitting || !password.trim()} type="submit">
            {isSubmitting ? 'Unlocking…' : 'Unlock'}
          </PrimaryButton>
        </form>
      </Card>
      <button
        className="w-full text-center text-sm font-medium text-muted-foreground transition hover:text-foreground"
        onClick={resetWallet}
        type="button"
      >
        Reset demo wallet
      </button>
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

const HISTORY_ENTRIES: HistoryEntry[] = [
  {
    id: '1',
    label: 'Received from Treasury',
    amount: '+320 XLM',
    date: 'Today',
    kind: 'received',
    status: 'confirmed',
  },
  {
    id: '2',
    label: 'Sent to Merchant',
    amount: '-48 XLM',
    date: 'Yesterday',
    kind: 'sent',
    status: 'confirmed',
  },
  {
    id: '3',
    label: 'Failed merchant payment',
    amount: '-12 XLM',
    date: 'Mar 23',
    kind: 'failed',
    status: 'failed',
  },
];

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
  const { filter, setFilter } = useHistoryFilter();
  const entries = React.useMemo(() => filterHistoryEntries(HISTORY_ENTRIES, filter), [filter]);

  return (
    <PageScaffold
      eyebrow="Activity"
      title="History"
      description="Filter recent transaction activity by sent, received, or failed status."
    >
      <HistoryActivityList activeFilter={filter} entries={entries} onFilterChange={setFilter} />
    </PageScaffold>
  );
}

function SessionKeysScreen() {
  return (
    <PageScaffold
      backTo="/settings"
      eyebrow="Security"
      title="Session Keys"
      description="Manage temporary signing permissions without leaving the extension flow."
    >
      <Card
        title="Active keys"
        description="Session keys can be rotated or revoked without affecting the primary wallet."
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-border px-4 py-3">
            <p className="text-sm font-medium text-foreground">Trading bot</p>
            <p className="mt-1 text-xs text-muted-foreground">Valid for 12 more hours</p>
          </div>
          <div className="rounded-xl border border-border px-4 py-3">
            <p className="text-sm font-medium text-foreground">Automation script</p>
            <p className="mt-1 text-xs text-muted-foreground">Read-only access, expires tomorrow</p>
          </div>
        </div>
      </Card>
      <PrimaryButton>
        <PlusCircle className="mr-2 h-4 w-4" />
        Add session key
      </PrimaryButton>
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
          {/* Demo create-account path — dev only */}
          {import.meta.env.DEV && (
            <Route
              element={
                <PublicOnlyGuard mode="onboarding">
                  <DemoCreateAccountScreen />
                </PublicOnlyGuard>
              }
              path="/create-account"
            />
          )}
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
