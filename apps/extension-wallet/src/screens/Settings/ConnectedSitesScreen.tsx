import * as React from 'react';
import { Globe, Trash2, ArrowLeft, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAllowlistStore } from '../../stores/allowlist';
import { useAccountStore } from '../../stores/account';
import { useSettingsStore } from '../../stores/settings';
import { EmptyTransactions } from '../../components/EmptyTransactions';

function truncateAddress(address: string, chars = 8): string {
  if (address.length <= chars * 2) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

function getHostname(origin: string): string {
  try {
    return new URL(origin).hostname.replace(/^www\./, '');
  } catch {
    return origin;
  }
}

function formatDate(value: number): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

export function ConnectedSitesScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { accounts, activeAccountId } = useAccountStore();
  const network = useSettingsStore((state) => state.network);
  const { getConnectedSites, revoke, revokeAll } = useAllowlistStore();

  const approvedSites = React.useMemo(() => {
    if (!activeAccountId) return [];
    return getConnectedSites(activeAccountId, network);
  }, [activeAccountId, network, getConnectedSites]);

  const activeAccount = React.useMemo(
    () => accounts.find((account) => account.id === activeAccountId),
    [accounts, activeAccountId]
  );

  function handleRevoke(origin: string) {
    if (!activeAccountId) return;
    revoke(origin, activeAccountId, network);
  }

  function handleDisconnectAll() {
    if (!activeAccountId) return;
    revokeAll(activeAccountId, network);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="bg-gradient-to-br from-primary to-purple-800 px-5 pb-7 pt-8 text-white">
        <div className="flex items-center justify-between">
          <button
            aria-label={t('settings.connectedSites.back')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            onClick={onBack}
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="h-9 w-9" />
        </div>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">
          {t('settings.connectedSites.section')}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {t('settings.connectedSites.title')}
        </h1>
        <p className="mt-1 text-sm text-white/70">{t('settings.connectedSites.description')}</p>
      </header>

      <main className="flex-1 space-y-4 p-4">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {t('settings.connectedSites.approvedOrigins')}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeAccount ? truncateAddress(activeAccount.address) : activeAccountId}
              </p>
            </div>
            {approvedSites.length > 0 ? (
              <button
                className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
                onClick={handleDisconnectAll}
                type="button"
              >
                {t('settings.connectedSites.disconnectAll')}
              </button>
            ) : null}
          </div>
          {approvedSites.length === 0 ? (
            <EmptyTransactions
              variant="all"
              message={t('settings.connectedSites.emptyTitle')}
              description={t('settings.connectedSites.emptyDescription')}
            />
          ) : (
            <div className="space-y-3">
              {approvedSites.map((site) => {
                const hostname = getHostname(site.origin);
                const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
                return (
                  <div
                    key={`${site.origin}-${site.accountId}-${site.network}`}
                    className="rounded-xl border border-border bg-background px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <img alt="" className="h-5 w-5 rounded-sm" src={faviconUrl} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {hostname}
                            </p>
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                              <Shield className="h-3 w-3" />
                              {site.network}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {site.origin}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                            <span>
                              {t('settings.connectedSites.connectedAccount')}:{' '}
                              {truncateAddress(site.accountId)}
                            </span>
                            <span>•</span>
                            <span>
                              {t('settings.connectedSites.connectedSince')}:{' '}
                              {formatDate(site.connectedAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        aria-label={`${t('settings.connectedSites.revokeAccess')} ${hostname}`}
                        className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-red-500"
                        onClick={() => handleRevoke(site.origin)}
                        title={t('settings.connectedSites.revokeAccess')}
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
