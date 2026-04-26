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
} from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Lock,
  PlusCircle,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { NotificationProvider } from '@ancore/ui-kit';
import {
  AuthGuard,
  ExtensionAuthProvider,
  PublicOnlyGuard,
  UnlockVerifier,
  useExtensionAuth,
} from './AuthGuard';
import { NavBar } from '../components/Navigation/NavBar';
import { SettingsScreen } from '../screens/Settings/SettingsScreen';
import { useDashboardSettingsStore } from '../state/dashboard-settings';

const APP_TITLE = 'Ancore Extension';

const pageTitles: Record<string, string> = {
  '/unlock': 'Unlock Wallet',
  '/welcome': 'Welcome',
  '/create-account': 'Create Account',
  '/home': 'Home',
  '/send': 'Send',
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
    return <Navigate replace to="/welcome" />;
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

function WelcomeScreen() {
  return (
    <PageScaffold
      eyebrow="Extension setup"
      title="Meet your Ancore wallet"
      description="Create a fresh account flow for first-time users, or jump back into an existing wallet."
    >
      <Card
        title="What this flow covers"
        description="Secure setup, protected routes, and a navigation shell built for the popup experience."
      >
        <div className="grid gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>First-time setup and unlock states stay separate.</span>
          </div>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Protected screens redirect automatically when the wallet is locked.</span>
          </div>
          <div className="flex items-center gap-3">
            <Wallet className="h-4 w-4 text-primary" />
            <span>Navigation works across dashboard, send, receive, history, and settings.</span>
          </div>
        </div>
      </Card>
      <div className="space-y-3">
        <SecondaryLink to="/unlock">I already have a wallet</SecondaryLink>
        <SecondaryLink to="/create-account">Create a wallet</SecondaryLink>
      </div>
    </PageScaffold>
  );
}

function CreateAccountScreen() {
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
      eyebrow="New wallet"
      title="Create account"
      description="This placeholder flow establishes a session so the protected routes can be exercised end to end."
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
          <PrimaryButton type="submit">
            Create wallet
            <ArrowRight className="ml-2 h-4 w-4" />
          </PrimaryButton>
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
        <SecondaryLink to="/receive">Receive funds</SecondaryLink>
        <SecondaryLink to="/history">View history</SecondaryLink>
        <SecondaryLink to="/session-keys">Session keys</SecondaryLink>
      </div>
    </PageScaffold>
  );
}

function SendScreen() {
  return (
    <PageScaffold
      eyebrow="Payments"
      title="Send"
      description="Draft a payment flow and keep users inside the authenticated part of the popup."
    >
      <Card
        title="New transaction"
        description="This screen is wired into routing and ready for the real send form."
      >
        <div className="space-y-3">
          <input
            className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none transition focus:border-primary"
            placeholder="Recipient address"
          />
          <input
            className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none transition focus:border-primary"
            placeholder="Amount"
          />
          <PrimaryButton>Review transaction</PrimaryButton>
        </div>
      </Card>
    </PageScaffold>
  );
}

function ReceiveScreen() {
  const network = useDashboardSettingsStore((state) => state.network);

  return (
    <PageScaffold
      eyebrow="Payments"
      title="Receive"
      description="Expose the wallet address and handoff to copy or QR actions."
    >
      <Card
        title="Receive funds"
        description={`Share this demo address with another wallet on ${network}.`}
      >
        <div className="rounded-xl border border-dashed border-border bg-background px-4 py-4 text-sm text-muted-foreground">
          GCFX...WALLET
        </div>
        <div className="mt-4 flex gap-3">
          <button
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-border px-4 py-3 text-sm font-semibold transition hover:bg-accent"
            type="button"
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy address
          </button>
          <button
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-border px-4 py-3 text-sm font-semibold transition hover:bg-accent"
            type="button"
          >
            Show QR
          </button>
        </div>
      </Card>
    </PageScaffold>
  );
}

function HistoryScreen() {
  const entries = [
    { id: '1', label: 'Received from Treasury', amount: '+320 XLM', date: 'Today' },
    { id: '2', label: 'Sent to Merchant', amount: '-48 XLM', date: 'Yesterday' },
    { id: '3', label: 'Session key refresh', amount: 'Security event', date: 'Mar 23' },
  ];

  return (
    <PageScaffold
      eyebrow="Activity"
      title="History"
      description="A route-backed transaction feed with room for richer filtering later."
    >
      <Card title="Recent activity">
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{entry.label}</p>
                <p className="text-xs text-muted-foreground">{entry.date}</p>
              </div>
              <span className="text-sm font-semibold text-foreground">{entry.amount}</span>
            </div>
          ))}
        </div>
      </Card>
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
    ? '/welcome'
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
  return (
    <PopupFrame>
      <TitleSync />
      <Routes>
        <Route element={<RootRedirect />} path="/" />
        <Route
          element={
            <PublicOnlyGuard mode="welcome">
              <WelcomeScreen />
            </PublicOnlyGuard>
          }
          path="/welcome"
        />
        <Route
          element={
            <PublicOnlyGuard mode="create-account">
              <CreateAccountScreen />
            </PublicOnlyGuard>
          }
          path="/create-account"
        />
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
            <Route element={<SendScreen />} path="/send" />
            <Route element={<ReceiveScreen />} path="/receive" />
            <Route element={<HistoryScreen />} path="/history" />
            <Route element={<SettingsScreen />} path="/settings" />
            <Route element={<SessionKeysScreen />} path="/session-keys" />
          </Route>
        </Route>
        <Route element={<NotFoundScreen />} path="*" />
      </Routes>
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
