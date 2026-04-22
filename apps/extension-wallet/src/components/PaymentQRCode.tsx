import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@ancore/ui-kit';

export interface PaymentQRCodeProps {
  /**
   * The value to encode in the QR code (typically a Stellar public key / address).
   */
  value: string;
  /**
   * Size in pixels for the QR code square. Defaults to 220.
   */
  size?: number;
  /**
   * Additional className applied to the outer wrapper div.
   */
  className?: string;
}

/**
 * PaymentQRCode – renders a scannable QR code for a Stellar public key.
 * Uses qrcode.react under the hood with a styled card border so it fits
 * the extension-wallet design system.
 */
export function PaymentQRCode({ value, size = 220, className }: PaymentQRCodeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900',
        className
      )}
      data-testid="payment-qr-code"
    >
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        includeMargin={false}
        aria-label={`QR code for address ${value}`}
      />
    </div>
  );
}
