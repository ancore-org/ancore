import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Download, ShieldCheck, Copy, Check } from 'lucide-react';
import { Button } from '@ancore/ui-kit';
import { PaymentQRCode } from '../../components/PaymentQRCode';
import { useCopyWithFeedback } from '../../hooks/useCopyWithFeedback';
import { truncateAddress } from '../../utils/address';
import {
  downloadPublicAddressQrPng,
  isPublicAddress,
  SecretExportBlockedError,
} from '../../utils/public-address-qr';
import { ScreenHeader } from './NetworkSettings';

interface AccountQrScreenProps {
  /** Public receive address (G/C/M). Never a secret — see public-address-qr.ts. */
  address: string | null;
  onBack: () => void;
}

/**
 * Settings → Address QR.
 *
 * Renders a downloadable QR of the account's public address, for support
 * tickets and desktop use outside the receive flow. Only the public address is
 * ever encoded; the export helper rejects anything else.
 */
export function AccountQrScreen({ address, onBack }: AccountQrScreenProps) {
  const { t } = useTranslation();
  const { copy, copied } = useCopyWithFeedback();
  const [downloadError, setDownloadError] = React.useState<string | null>(null);
  const [downloading, setDownloading] = React.useState(false);

  const exportable = address !== null && isPublicAddress(address);

  const handleDownload = React.useCallback(async () => {
    if (!address) return;

    setDownloadError(null);
    setDownloading(true);
    try {
      await downloadPublicAddressQrPng(address);
    } catch (error) {
      setDownloadError(
        error instanceof SecretExportBlockedError
          ? error.message
          : t('settings.accountQr.downloadFailed')
      );
    } finally {
      setDownloading(false);
    }
  }, [address, t]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ScreenHeader title={t('settings.accountQr.title')} onBack={onBack} />

      <div className="flex flex-col gap-5 p-4">
        {!exportable ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {t('settings.accountQr.unavailable')}
          </p>
        ) : (
          <>
            <div className="flex flex-col items-center gap-4">
              <PaymentQRCode value={address} size={200} />

              <button
                type="button"
                onClick={() => void copy(address)}
                className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 font-mono text-xs text-muted-foreground hover:bg-accent transition-colors"
                aria-label={t('settings.accountQr.copyAddress')}
              >
                {truncateAddress(address)}
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            <Button onClick={() => void handleDownload()} disabled={downloading} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              {downloading
                ? t('settings.accountQr.downloading')
                : t('settings.accountQr.downloadPng')}
            </Button>

            {downloadError && (
              <p role="alert" className="text-xs text-destructive text-center">
                {downloadError}
              </p>
            )}

            <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-500/10 text-green-600">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground">{t('settings.accountQr.safetyTitle')}</p>
                <p className="mt-0.5">{t('settings.accountQr.safetyBody')}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
