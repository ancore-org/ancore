import { useMemo } from 'react';
import { getAccountState, initializeAccountStore, useAccountStore } from '../stores/account';
import { setSessionState, useSessionStore, type AppRoute } from '../stores/session';
import { initializeSettingsStore, useSettingsStore } from '../stores/settings';

const routes: Array<{ id: AppRoute; label: string; description: string }> = [
  {
    id: 'home',
    label: 'Home',
    description: 'Wallet overview, balances, and quick actions will land here.',
  },
  {
    id: 'accounts',
    label: 'Accounts',
    description: 'Account selection, creation, and import flows will live here.',
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Network, theme, and extension preferences will live here.',
  },
];

function navigate(route: AppRoute) {
  setSessionState((current) => ({
    ...current,
    currentRoute: route,
    lastActiveAt: Date.now(),
  }));
}

export function RouterShell(): JSX.Element {
  initializeAccountStore();
  initializeSettingsStore();

  const account = useAccountStore();
  const session = useSessionStore();
  const settings = useSettingsStore();

  const activeRoute = useMemo(
    () => routes.find((route) => route.id === session.currentRoute) ?? routes[0],
    [session.currentRoute]
  );

  const activeAccount = getAccountState().accounts.find(
    (entry) => entry.id === account.activeAccountId
  );

  return (
    <div className="mx-auto flex min-h-screen w-[360px] flex-col bg-slate-950 text-slate-50">
      <header className="border-b border-white/10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_45%),linear-gradient(180deg,_rgba(15,23,42,0.9),_rgba(2,6,23,1))] px-5 pb-5 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">Ancore Wallet</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Extension shell</h1>
          </div>
          <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
            {session.status}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {routes.map((route) => {
            const isActive = route.id === activeRoute.id;

            return (
              <button
                key={route.id}
                type="button"
                onClick={() => navigate(route.id)}
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
          <h2 className="mt-2 text-xl font-semibold text-white">{activeRoute.label}</h2>
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

        <section className="rounded-3xl border border-dashed border-cyan-400/30 bg-cyan-400/5 p-4 text-sm leading-6 text-cyan-50/90">
          This scaffold wires manifest, popup, background worker, navigation, and initial stores.
          Feature-specific screens can now replace these placeholders incrementally.
        </section>
      </main>
    </div>
  );
}
