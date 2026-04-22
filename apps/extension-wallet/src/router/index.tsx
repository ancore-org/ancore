import { Suspense, lazy, useState } from 'react';
import { useAccountStore } from '../stores/account';
import { useSessionStore, type AppRoute } from '../stores/session';
import { useSettingsStore } from '../stores/settings';
import { HelpCenter } from '../components/HelpCenter';
import helpContent from '../data/help-content.json';

// Lazy-loaded screens
const HomeScreen = lazy(() => import('../screens/HomeScreen'));
const SettingsScreen = lazy(() =>
  import('../screens/Settings/AboutScreen').then((m) => ({ default: m.AboutScreen }))
);

function Tooltip({ text }: { text: string }): JSX.Element {
  return (
    <span className="group relative ml-2 inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-300/10 text-[11px] font-bold text-cyan-200">
      ?
      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-56 -translate-x-1/2 rounded-xl border border-white/10 bg-slate-950 px-2 py-1.5 text-[11px] font-normal leading-5 text-slate-200 shadow-xl group-hover:block">
        {text}
      </span>
    </span>
  );
}

export function RouterShell(): JSX.Element {
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const account = useAccountStore();
  const session = useSessionStore();
  const settings = useSettingsStore();
  const [helpCenterOpen, setHelpCenterOpen] = useState(false);

  const activeAccount = accounts.find((a) => a.id === activeAccountId);

  const routes: Array<{ id: AppRoute; label: string; description: string; tooltip: string }> = [
    {
      id: 'home',
      label: 'Home',
      description: 'Wallet overview and quick actions.',
      tooltip: helpContent.tooltips.receive,
    },
    {
      id: 'accounts',
      label: 'Accounts',
      description: 'Account selection and import.',
      tooltip: helpContent.tooltips.send,
    },
    {
      id: 'settings',
      label: 'Settings',
      description: 'Network, theme, and preferences.',
      tooltip: helpContent.tooltips.security,
    },
  ];

  const activeRoute = routes.find((r) => r.id === session.currentRoute) ?? routes[0];

  const renderActiveScreen = () => {
    switch (session.currentRoute) {
      case 'home':
        return <HomeScreen />;
      case 'settings':
        return <SettingsScreen />;
      case 'accounts':
        return <HomeScreen />; // fallback
      default:
        return <HomeScreen />;
    }
  };

  return (
    <>
      <div className="mx-auto flex min-h-screen w-[360px] flex-col bg-slate-950 text-slate-50">
        <header className="border-b border-white/10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_45%),linear-gradient(180deg,_rgba(15,23,42,0.9),_rgba(2,6,23,1))] px-5 pb-5 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">Ancore Wallet</p>
              <h1 className="mt-2 text-2xl font-semibold text-white">Extension shell</h1>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
                {session.status}
              </div>
              <button
                type="button"
                onClick={() => setHelpCenterOpen(true)}
                className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[11px] font-medium text-cyan-100 transition hover:bg-cyan-300/20"
              >
                Help Center
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {routes.map((route) => {
              const isActive = route.id === activeRoute.id;
              return (
                <button
                  key={route.id}
                  type="button"
                  title={route.tooltip}
                  onClick={() => session.navigate(route.id)}
                  className={[
                    'rounded-2xl px-3 py-2 text-sm transition',
                    isActive
                      ? 'bg-cyan-300 text-slate-950 shadow-[0_10px_30px_rgba(103,232,249,0.25)]'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white',
                  ].join(' ')}
                >
                  {route.label}
                </button>
              );
            })}
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-4 bg-[linear-gradient(180deg,_rgba(15,23,42,0),_rgba(15,23,42,0.65)),linear-gradient(180deg,_#020617,_#0f172a)] px-5 py-5">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Active route</p>
            <h2 className="mt-2 flex items-center text-xl font-semibold text-white">
              {activeRoute.label}
              <Tooltip text={activeRoute.tooltip} />
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{activeRoute.description}</p>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Wallet store</p>
              <div className="mt-3 space-y-2 text-sm text-slate-200">
                <p>Active account: {activeAccount?.label ?? 'No account selected'}</p>
                <p>Known accounts: {account.accounts.length}</p>
                <p>Hydrated: {account.hydrated ? 'yes' : 'no'}</p>
              </div>
            </article>

            <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Settings store</p>
              <div className="mt-3 space-y-2 text-sm text-slate-200">
                <p>Network: {settings.network}</p>
                <p>Theme: {settings.theme}</p>
                <p>Auto lock: {settings.autoLockMinutes} min</p>
              </div>
            </article>
          </section>

          {/* Suspense for lazy-loaded screens */}
          <Suspense
            fallback={<div className="p-8 text-center text-cyan-400 animate-pulse">Loading...</div>}
          >
            {renderActiveScreen()}
          </Suspense>

          <section className="rounded-3xl border border-dashed border-cyan-400/30 bg-cyan-400/5 p-4 text-sm leading-6 text-cyan-50/90">
            Zustand stores wired with extension storage persistence. Auto-lock and session
            management active. Feature-specific screens can replace these placeholders
            incrementally.
          </section>
        </main>
      </div>

      {/* Help Center Modal */}
      <HelpCenter open={helpCenterOpen} onClose={() => setHelpCenterOpen(false)} />
    </>
  );
}
