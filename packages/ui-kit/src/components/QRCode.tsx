import { QRCodeSVG } from 'qrcode.react';
import React from 'react';

interface QRCodeProps {
  address: string;
  size?: number;
  ariaLabel?: string;
}

export const StellarQRCode: React.FC<QRCodeProps> = ({ address, size = 128, ariaLabel }) => {
  return (
    <QRCodeSVG
      value={address}
      size={size}
      includeMargin={true}
      role="img"
      aria-label={ariaLabel || `QR code for address ${address}`}
      tabIndex={0}
      style={{ display: 'inline-block' }}
    />
  );
};
