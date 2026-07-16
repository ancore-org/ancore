import * as React from 'react';
import { cn } from '@ancore/ui-kit';
import { X, Link2, Share2 } from 'lucide-react';
import { PaymentQRCode } from '@/components/PaymentQRCode';
import downloadQrPng from '@/utils/export-qr';
import { useCopyWithFeedback } from '@/hooks/useCopyWithFeedback';
import type { Network } from '@ancore/types';

export interface ReceiveScreenProps {
  smartAccountId?: string | null;
  ownerPublicKey?: string | null;
  /** Display name shown above the QR (wallet name). */
  walletName?: string | null;
  network?: Network;
  onBack?: () => void;
  className?: string;
}

function buildPaymentUri(destination: string, network: Network): string {
  return `web+stellar:pay?destination=${encodeURIComponent(destination)}&network=${encodeURIComponent(network)}`;
}

function truncateMiddle(value: string, head = 6, tail = 6): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/**
 * Receive — QR-first layout (ref: clean receive sheet).
 * Dark canvas, centered identity + QR, soft share CTA, asset warning.
 */
export function ReceiveScreen({
  smartAccountId,
  ownerPublicKey,
  walletName,
  network = 'testnet',
  onBack,
  className,
}: ReceiveScreenProps) {
  const { copy, copied } = useCopyWithFeedback();
  const qrRef = React.useRef<SVGSVGElement>(null);
  const paymentUri = smartAccountId ? buildPaymentUri(smartAccountId, network) : '';
  const displayName = walletName?.trim() || 'Ancore Wallet';

  const handleShare = React.useCallback(async () => {
    if (!smartAccountId) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Ancore receive address',
          text: smartAccountId,
        });
        return;
      }
    } catch {
      /* user cancelled or share unavailable */
    }
    await copy(smartAccountId);
  }, [smartAccountId, copy]);

  const handleCopyAddress = React.useCallback(() => {
    if (smartAccountId) void copy(smartAccountId);
  }, [smartAccountId, copy]);

  if (!smartAccountId) {
    return (
      <div className={cn('wallet-sheet', className)}>
        <header className="wallet-header">
          <h1 className="wallet-title">Receive</h1>
          {onBack && (
            <button type="button" className="wallet-icon-btn" aria-label="Close" onClick={onBack}>
              <X className="h-5 w-5" />
            </button>
          )}
        </header>
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <p className="text-[15px] text-muted-foreground">
            Complete onboarding to get your receive address
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('wallet-sheet', className)}>
      <header className="wallet-header">
        <h1 className="wallet-title">Receive</h1>
        {onBack && (
          <button type="button" className="wallet-icon-btn" aria-label="Close" onClick={onBack}>
            <X className="h-5 w-5" />
          </button>
        )}
      </header>

      <div className="flex flex-1 flex-col items-center px-6 pb-8 pt-6">
        <div className="mb-6 text-center">
          <p className="text-[20px] font-semibold tracking-tight text-foreground">{displayName}</p>
          <button
            type="button"
            onClick={handleCopyAddress}
            className="mt-1 inline-flex items-center gap-1.5 text-[14px] text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Copy address"
          >
            <span className="font-mono">{truncateMiddle(smartAccountId, 8, 6)}</span>
            <Link2 className="h-3.5 w-3.5 opacity-70" aria-hidden />
            {copied && <span className="text-[12px] text-emerald-400">Copied</span>}
          </button>
        </div>

        <div className="mb-8 rounded-[28px] bg-white p-4 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
          <PaymentQRCode
            value={paymentUri}
            size={220}
            qrRef={qrRef}
            aria-label={`QR code for smart account ${smartAccountId}`}
          />
        </div>

        <p className="mb-8 max-w-[300px] text-center text-[13px] leading-relaxed text-muted-foreground">
          Use this address to receive XLM and Stellar assets such as USDC. Sending other network
          assets may result in permanent loss.
        </p>

        {ownerPublicKey && (
          <p className="mb-6 max-w-[300px] text-center text-[11px] text-muted-foreground/70">
            Owner key: <span className="font-mono">{truncateMiddle(ownerPublicKey, 6, 6)}</span>
          </p>
        )}

        <div className="mt-auto w-full space-y-3">
          <button type="button" className="wallet-pill-btn-secondary" onClick={handleShare}>
            <Share2 className="mr-2 h-4 w-4" aria-hidden />
            Share Address
          </button>
          <button
            type="button"
            className="w-full py-2 text-[13px] text-muted-foreground hover:text-foreground"
            onClick={async () => {
              try {
                await downloadQrPng(paymentUri, {
                  filename: `ancore-receive-${smartAccountId.slice(0, 8)}.png`,
                  scale: 3,
                });
              } catch {
                /* non-blocking */
              }
            }}
          >
            Download QR
          </button>
        </div>
      </div>
    </div>
  );
}
