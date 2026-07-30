import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Usb, Unplug, Check, AlertTriangle } from 'lucide-react';
import { Button, Input } from '@ancore/ui-kit';
import { ScreenHeader } from './NetworkSettings';
import { useHardwareWalletStore } from '../../stores/hardware-wallet';
import { formatLedgerError, pairLedgerDevice } from '../../security/ledger';
import { LedgerSigningAdapter } from '@ancore/core-sdk';

interface HardwareWalletSettingsProps {
  onBack: () => void;
}

export function HardwareWalletSettings({ onBack }: HardwareWalletSettingsProps) {
  const { t } = useTranslation();
  const signerMode = useHardwareWalletStore((s) => s.signerMode);
  const ledgerPublicKey = useHardwareWalletStore((s) => s.ledgerPublicKey);
  const ledgerPath = useHardwareWalletStore((s) => s.ledgerPath);
  const ledgerAccountIndex = useHardwareWalletStore((s) => s.ledgerAccountIndex);
  const ledgerAppVersion = useHardwareWalletStore((s) => s.ledgerAppVersion);
  const setSignerMode = useHardwareWalletStore((s) => s.setSignerMode);
  const setLedgerAccountIndex = useHardwareWalletStore((s) => s.setLedgerAccountIndex);
  const clearPairedLedger = useHardwareWalletStore((s) => s.clearPairedLedger);

  const [accountIndexInput, setAccountIndexInput] = React.useState(String(ledgerAccountIndex));
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<'idle' | 'prompt' | 'success' | 'error'>('idle');
  const [error, setError] = React.useState('');
  const [supported, setSupported] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    void LedgerSigningAdapter.isSupported().then(setSupported);
  }, []);

  React.useEffect(() => {
    setAccountIndexInput(String(ledgerAccountIndex));
  }, [ledgerAccountIndex]);

  async function handlePair() {
    setBusy(true);
    setError('');
    setStatus('prompt');
    const index = Number.parseInt(accountIndexInput, 10);
    if (!Number.isInteger(index) || index < 0) {
      setError(t('settings.hardware.invalidIndex'));
      setStatus('error');
      setBusy(false);
      return;
    }
    setLedgerAccountIndex(index);

    try {
      await pairLedgerDevice(index);
      setStatus('success');
    } catch (err) {
      setError(formatLedgerError(err));
      setStatus('error');
    } finally {
      setBusy(false);
    }
  }

  function handleUseSoftware() {
    setSignerMode('software');
    setStatus('idle');
    setError('');
  }

  function handleDisconnect() {
    clearPairedLedger();
    setStatus('idle');
    setError('');
  }

  const truncated =
    ledgerPublicKey.length > 12
      ? `${ledgerPublicKey.slice(0, 4)}…${ledgerPublicKey.slice(-4)}`
      : ledgerPublicKey;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ScreenHeader title={t('settings.hardware.title')} onBack={onBack} />

      <div className="flex-1 space-y-5 p-4">
        <p className="text-sm text-muted-foreground">{t('settings.hardware.description')}</p>

        {supported === false && (
          <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{t('settings.hardware.webhidUnsupported')}</p>
          </div>
        )}

        <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">
            {t('settings.hardware.signerPreference')}
          </h2>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={signerMode === 'software' ? 'default' : 'outline'}
              className="flex-1"
              onClick={handleUseSoftware}
            >
              {t('settings.hardware.software')}
            </Button>
            <Button
              type="button"
              variant={signerMode === 'ledger' ? 'default' : 'outline'}
              className="flex-1"
              disabled={!ledgerPublicKey}
              onClick={() => setSignerMode('ledger')}
            >
              {t('settings.hardware.ledger')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('settings.hardware.ownerOpsOnly')}</p>
        </section>

        <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <label className="block text-sm font-semibold text-foreground" htmlFor="ledger-index">
            {t('settings.hardware.accountIndex')}
          </label>
          <Input
            id="ledger-index"
            type="number"
            min={0}
            step={1}
            value={accountIndexInput}
            onChange={(e) => setAccountIndexInput(e.target.value)}
            disabled={busy}
          />
          <p className="text-xs text-muted-foreground">
            {t('settings.hardware.pathHint', { path: `m/44'/148'/${accountIndexInput || '0'}'` })}
          </p>

          <Button
            type="button"
            className="w-full"
            disabled={busy || supported === false}
            onClick={handlePair}
          >
            <Usb className="mr-2 h-4 w-4" />
            {busy ? t('settings.hardware.confirmOnDevice') : t('settings.hardware.connect')}
          </Button>

          {status === 'prompt' && (
            <p className="text-center text-sm text-muted-foreground">
              {t('settings.hardware.confirmOnDevice')}
            </p>
          )}
          {status === 'success' && (
            <p className="flex items-center justify-center gap-1 text-sm text-green-600">
              <Check className="h-4 w-4" />
              {t('settings.hardware.paired')}
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </section>

        {ledgerPublicKey && (
          <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">
              {t('settings.hardware.pairedDevice')}
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t('settings.hardware.address')}</dt>
                <dd className="font-mono text-foreground" title={ledgerPublicKey}>
                  {truncated}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t('settings.hardware.path')}</dt>
                <dd className="font-mono text-foreground">
                  {ledgerPath || `44'/148'/${ledgerAccountIndex}'`}
                </dd>
              </div>
              {ledgerAppVersion && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{t('settings.hardware.appVersion')}</dt>
                  <dd className="text-foreground">{ledgerAppVersion}</dd>
                </div>
              )}
            </dl>
            <Button type="button" variant="outline" className="w-full" onClick={handleDisconnect}>
              <Unplug className="mr-2 h-4 w-4" />
              {t('settings.hardware.disconnect')}
            </Button>
          </section>
        )}
      </div>
    </div>
  );
}
