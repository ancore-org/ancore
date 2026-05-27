import { useEffect, useMemo, type ReactNode, useState } from 'react';
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
} from 'react-router-dom';

import { DashboardAuthProvider, useDashboardAuth } from '../auth';
import { ScheduledTransfersPage } from '../pages/ScheduledTransfers';
import { TransactionsPage } from '../pages/transactions';

function ShellMessage({ title, description }: { title: string; description: string }) {
  return (
    <main aria-label={title} className="flex min-h-screen items-center justify-center p-6">
      <section className="max-w-sm rounded-xl border border-slate-200 p-6 text-center">
        <h1 className="text-xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Ancore Dashboard</p>
            <h1 className="text-lg font-semibold">Protected workspace</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{session?.displayName ?? 'Guest'}</span>
            <button onClick={logout} type="button">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-5xl gap-6 px-6 py-6 lg:grid-cols-[220px_1fr]">
        <nav className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
          <Link to="/dashboard">Overview</Link>
          <Link to="/dashboard/transactions">Transactions</Link>
          <Link to="/dashboard/scheduled-transfers">Scheduled Transfers</Link>
          <Link to="/dashboard/reports">Reports</Link>
          <Link to="/dashboard/settings">Settings</Link>
        </nav>
        <main className="rounded-xl border border-slate-200 bg-white p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function OverviewPage() {
  const { session } = useDashboardAuth();

  return (
    <section>
      <h2 className="text-2xl font-semibold">Overview</h2>
      <p className="mt-2 text-sm text-slate-600">
        Signed in as {session?.displayName ?? 'dashboard user'}.
      </p>
    </section>
  );
}

function ReportsPage() {
  return (
    <section>
      <h2 className="text-2xl font-semibold">Reports</h2>
      <p className="mt-2 text-sm text-slate-600">Placeholder route for reporting workstreams.</p>
    </section>
  );
}

function SettingsPage() {
  return (
    <section>
      <h2 className="text-2xl font-semibold">Settings</h2>
      <p className="mt-2 text-sm text-slate-600">Placeholder route for dashboard preferences.</p>
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
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-slate-600">
          Use the shell login entry to continue into protected routes.
        </p>
        <label className="mt-6 block text-sm font-medium text-slate-700">
          Display name
          <input
            aria-label="Display name"
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
            onChange={(event) => setDisplayName(event.target.value)}
            value={displayName}
          />
        </label>
        <button
          className="mt-4 w-full rounded-lg bg-slate-950 px-4 py-2 text-white"
          onClick={() => {
            login(displayName);
            navigate(from, { replace: true });
          }}
          type="button"
        >
          Continue
        </button>
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
    <BrowserRouter>
      <DashboardAuthProvider>
        <DashboardRouterContent />
      </DashboardAuthProvider>
    </BrowserRouter>
  );
}

export function DashboardAppTestHarness({ initialEntries }: { initialEntries: string[] }) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <DashboardAuthProvider>
        <DashboardRouterContent />
      </DashboardAuthProvider>
    </MemoryRouter>
  );
}
