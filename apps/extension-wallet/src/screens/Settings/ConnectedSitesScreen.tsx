import * as React from 'react';
import { Globe, Trash2, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAllowlistStore } from '../../stores/allowlist';
import { useAccountStore } from '../../stores/account';
import { useSettingsStore } from '../../stores/settings';
import { EmptyTransactions } from '../../components/EmptyTransactions';

export function ConnectedSitesScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { activeAccountId } = useAccountStore();
  const network = useSettingsStore((state) => state.network);
  const { getApprovedList, revoke } = useAllowlistStore();

  const approvedSites = React.useMemo(() => {
    if (!activeAccountId) return [];
    return getApprovedList(activeAccountId, network);
  }, [activeAccountId, network, getApprovedList]);

  function handleRevoke(origin: string) {
    if (!activeAccountId) return;
    revoke(origin, activeAccountId, network);
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="bg-gradient-to-br from-primary to-purple-800 px-5 pb-7 pt-8 text-white">
        <div className="flex items-center justify-between">
          <button
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            onClick={onBack}
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="h-9 w-9" />
        </div>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">
          Security
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Connected Sites</h1>
        <p className="mt-1 text-sm text-white/70">Manage sites that have access to your wallet.</p>
      </header>

      <main className="flex-1 space-y-4 p-4">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-4">Approved Origins</h2>
          {approvedSites.length === 0 ? (
            <EmptyTransactions
              variant="all"
              message="No connected sites"
              description="You haven't approved any sites to connect to this account on this network."
            />
          ) : (
            <div className="space-y-3">
              {approvedSites.map((site) => (
                <div
                  key={site}
                  className="flex items-center justify-between rounded-xl border border-border px-4 py-3 bg-background"
                >
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium text-foreground">{site}</span>
                  </div>
                  <button
                    onClick={() => handleRevoke(site)}
                    className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                    title="Revoke access"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
