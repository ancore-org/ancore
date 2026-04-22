import * as React from 'react';

import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';

export interface QRCodeProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  size?: number;
  label?: string;
}

/**
 * QRCode renders a styled, accessible SVG QR code for wallet addresses.
 */
export function QRCode({
  value,
  size = 192,
  label,
  className,
  ...props
}: QRCodeProps): React.JSX.Element {
  const ariaLabel = label ?? `QR code for address ${value}`;

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-4 shadow-sm',
        className
      )}
      {...props}
    >
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        includeMargin={false}
        aria-label={ariaLabel}
        role="img"
      />
    </div>
  );
}
