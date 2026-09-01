import { useEffect, useMemo, type ReactNode, useState } from 'react';
import {
  BrowserRouter,
  MemoryRouter,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  FileText,
  LogOut,
  Send,
  Settings,
  Sparkles,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { cn } from '@ancore/ui-kit';

import { DashboardAuthProvider, useDashboardAuth } from '../auth';
import { AppErrorBoundary, RouteErrorBoundary } from '../components/AppErrorBoundary';

/**
 * This is the app's only router. A second `BrowserRouter` lived in
 * `src/App.tsx` with a different, partly broken set of paths (`/send`,
 * `/request`, `/scan` at the root, and a `/transactions` route hardcoded to
 * `transactions={[]}`). Nothing imported it — not `main.tsx`, not
 * `index.html`, not a test — so it was never mounted, but it was the obvious
 * place to look when a nav link appeared dead, and it is the likely source of
 * the earlier "dead nav route" reports. It has been deleted (#1347).
 *
 * Removing it orphaned the modules only it referenced: `components/Layout`,
 * `pages/Account`, `pages/Dashboard`, `pages/SplitBill` and
 * `pages/SplitBillDetail`. They are left in place rather than deleted in the
 * same change — whether those features should be routed here or dropped is a
 * product decision, not a dead-code cleanup, and their tests still pass.
 */
import { BulkPayoutsPage } from '../pages/BulkPayouts';
import { ScheduledTransfersPage } from '../pages/ScheduledTransfers';
import { SendPage } from '../pages/Send';
import { TransactionsPage } from '../pages/transactions';
import { StatementExportModal } from '../features/statements/StatementExportModal';

function ShellMessage({ title, description }: { title: string; description: string }) {
  return (
    <main aria-label={title} className="dashboard-shell flex items-center justify-center p-6">
      <section className="dashboard-panel w-full max-w-sm p-6 text-center">
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
        </span>
        <h1 className="mt-5 text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </section>
    </main>
  );
}

function DashboardLoadingGate({ children }: { children: ReactNode }) {
  const { isBootstrapped, status } = useDashboardAuth();

  if (!isBootstrapped) {
    return (
      <ShellMessage title="Loading dashboard" description="Bootstrapping your session state." />
    );
  }

  if (status === 'refreshing') {
    return (
      <ShellMessage
        title="Refreshing session"
        description="Checking your access token before loading the dashboard."
      />
    );
  }

  return <>{children}</>;
}

function ProtectedRoute() {
  const { status } = useDashboardAuth();
  const location = useLocation();

  if (status !== 'authenticated') {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }

  return <Outlet />;
}

function GuestRoute() {
  const { status } = useDashboardAuth();

  if (status === 'authenticated') {
    return <Navigate replace to="/dashboard" />;
  }

  return <Outlet />;
}

function RootRedirect() {
  const { status } = useDashboardAuth();

  if (status === 'authenticated') {
    return <Navigate replace to="/dashboard" />;
  }

  if (status === 'refreshing') {
    return <Navigate replace to="/dashboard" />;
  }

  return <Navigate replace to="/login" />;
}

function DashboardLayout() {
  const { session, logout } = useDashboardAuth();
  const navigation = [
    { to: '/dashboard', label: 'Overview', icon: BarChart3, end: true },
    { to: '/dashboard/transactions', label: 'Transactions', icon: FileText },
    { to: '/dashboard/send', label: 'Send', icon: Send },
    { to: '/dashboard/bulk-payouts', label: 'Bulk payouts', icon: UsersRound },
    { to: '/dashboard/scheduled-transfers', label: 'Scheduled', icon: CalendarClock },
    { to: '/dashboard/reports', label: 'Reports', icon: FileText },
    { to: '/dashboard/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="dashboard-shell lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="border-b border-border bg-[hsl(var(--surface-sunken))] px-4 py-4 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background">
              <WalletCards className="h-4 w-4" strokeWidth={2} />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight">Ancore</p>
              <p className="text-xs text-muted-foreground">Wallet operations</p>
            </div>
          </div>
          <div className="flex items-center gap-2 lg:hidden">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            <span className="text-xs font-medium text-muted-foreground">Testnet</span>
          </div>
        </div>
        <nav
          className="mt-5 grid grid-cols-4 gap-1 overflow-x-auto lg:grid-cols-1"
          aria-label="Dashboard"
        >
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              aria-label={label}
              title={label}
              className={({ isActive }) =>
                cn(
                  'dashboard-nav-link justify-center lg:justify-start',
                  isActive && 'dashboard-nav-link-active'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span className="hidden lg:inline">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto hidden border-t border-border pt-4 lg:block">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-xs font-semibold">
              {(session?.displayName ?? 'G').slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {session?.displayName ?? 'Guest'}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Stellar testnet
              </span>
            </div>
            <button
              aria-label="Sign out"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={logout}
              type="button"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 px-5 py-7 sm:px-8 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-6xl">
          {/* Inside the shell, so a page that throws leaves the navigation
              usable and the user can walk away from it (#1348). */}
          <RouteErrorBoundary>
            <Outlet />
          </RouteErrorBoundary>
        </div>
      </main>
    </div>
  );
}

function OverviewPage() {
  const { session } = useDashboardAuth();

  return (
    <section className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Workspace
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Overview</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Signed in as {session?.displayName ?? 'dashboard user'}.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ['Available balance', '1,245.80 XLM'],
          ['Pending', '0.00 XLM'],
          ['This month', '24 payments'],
        ].map(([label, value]) => (
          <article className="dashboard-panel p-5" key={label}>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-7 text-xl font-semibold tracking-tight">{value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ReportsPage() {
  const [isStatementExportOpen, setIsStatementExportOpen] = useState(false);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Reports</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Export account statements for bookkeeping and reconciliation.
        </p>
      </div>

      <div className="dashboard-panel p-6">
        <h3 className="text-lg font-medium">Statement export</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Download CSV (always available) or PDF (when enabled) records of your account activity
          from the indexer. Use date filters to narrow the export to a specific period.
        </p>
        <div className="mt-4 flex items-center gap-4">
          <button
            className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
            onClick={() => setIsStatementExportOpen(true)}
            type="button"
          >
            Export statement
          </button>
          <p className="text-xs text-muted-foreground">
            CSV columns: Timestamp, Counterparty, Amount, Asset, Status, Memo/Reference
          </p>
        </div>
      </div>

      <div className="dashboard-panel p-6">
        <h3 className="text-lg font-medium">Privacy note</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Statement exports contain transaction data fetched directly from the Ancore indexer for
          the currently selected account. Memo fields are sanitized before inclusion in PDF exports
          to prevent injection. Exported files are generated client-side and never transmitted to
          third-party servers. Store exported files securely — they contain financial activity
          associated with your Stellar account.
        </p>
      </div>

      <StatementExportModal
        accountId="GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"
        isOpen={isStatementExportOpen}
        onClose={() => setIsStatementExportOpen(false)}
      />
    </section>
  );
}

function SettingsPage() {
  return (
    <section>
      <h2 className="text-2xl font-semibold">Settings</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Placeholder route for dashboard preferences.
      </p>
    </section>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, status } = useDashboardAuth();
  const [displayName, setDisplayName] = useState('Dashboard User');

  const from = useMemo(() => {
    const state = location.state as { from?: string } | null;
    return state?.from ?? '/dashboard';
  }, [location.state]);

  useEffect(() => {
    if (status === 'authenticated') {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate, status]);

  return (
    <main className="dashboard-shell flex items-center justify-center p-5">
      <section className="w-full max-w-sm">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-foreground text-background">
          <WalletCards className="h-5 w-5" />
        </span>
        <p className="mt-10 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Ancore dashboard
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Sign in</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Continue to your secure wallet operations workspace.
        </p>
        <label className="mt-8 block text-sm font-medium">
          Display name
          <input
            aria-label="Display name"
            className="dashboard-field mt-2"
            onChange={(event) => setDisplayName(event.target.value)}
            value={displayName}
          />
        </label>
        <button
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform duration-150 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98]"
          onClick={() => {
            login(displayName);
            navigate(from, { replace: true });
          }}
          type="button"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Session data stays in this browser.
        </p>
      </section>
    </main>
  );
}

function NotFoundPage() {
  const { status } = useDashboardAuth();

  return (
    <ShellMessage
      title="Page not found"
      description={
        status === 'authenticated' ? 'Return to the dashboard shell.' : 'Sign in again to continue.'
      }
    />
  );
}

export function DashboardRouterContent() {
  return (
    <>
      <Routes>
        <Route
          element={
            <DashboardLoadingGate>
              <RootRedirect />
            </DashboardLoadingGate>
          }
          path="/"
        />
        <Route
          element={
            <DashboardLoadingGate>
              <GuestRoute />
            </DashboardLoadingGate>
          }
        >
          <Route element={<LoginPage />} path="/login" />
        </Route>
        <Route
          element={
            <DashboardLoadingGate>
              <ProtectedRoute />
            </DashboardLoadingGate>
          }
        >
          <Route element={<DashboardLayout />}>
            <Route element={<OverviewPage />} path="/dashboard" />
            <Route element={<TransactionsPage />} path="/dashboard/transactions" />
            <Route element={<SendPage />} path="/dashboard/send" />
            <Route element={<BulkPayoutsPage />} path="/dashboard/bulk-payouts" />
            <Route element={<ScheduledTransfersPage />} path="/dashboard/scheduled-transfers" />
            <Route element={<ReportsPage />} path="/dashboard/reports" />
            <Route element={<SettingsPage />} path="/dashboard/settings" />
          </Route>
        </Route>
        <Route
          element={
            <DashboardLoadingGate>
              <NotFoundPage />
            </DashboardLoadingGate>
          }
          path="*"
        />
      </Routes>
    </>
  );
}

export function DashboardApp() {
  return (
    // Outside the router and the auth provider, so a throw in either is still
    // caught. This is the last line before React unmounts the whole tree and
    // leaves a blank page (#1348).
    <AppErrorBoundary>
      <BrowserRouter>
        <DashboardAuthProvider>
          <DashboardRouterContent />
        </DashboardAuthProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  );
}

export function DashboardAppTestHarness({ initialEntries }: { initialEntries: string[] }) {
  return (
    <AppErrorBoundary>
      <MemoryRouter initialEntries={initialEntries}>
        <DashboardAuthProvider>
          <DashboardRouterContent />
        </DashboardAuthProvider>
      </MemoryRouter>
    </AppErrorBoundary>
  );
}
