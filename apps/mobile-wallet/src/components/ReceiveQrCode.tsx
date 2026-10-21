/**
 * ReceiveQrCode - QR code generator for receiving payments.
 *
 * Renders a scannable QR code for the user's public address using
 * react-native-qrcode-svg. Includes high contrast settings and
 * appropriate error correction level for reliable scanning.
 *
 * Usage:
 * ```tsx
 * <ReceiveQrCode
 *   address="GABC..."
 *   size={220}
 *   onShare={() => Share.share({ message: address })}
 * />
 * ```
 */

import React from 'react';
import QRCode from 'react-native-qrcode-svg';

export interface ReceiveQrCodeProps {
  /** The Stellar address (smart account or public key) to encode in the QR code */
  address: string;
  /** Size of the QR code in pixels (default: 220) */
  size?: number;
  /** Optional callback when share button is pressed */
  onShare?: () => void;
  /** Optional test ID for testing */
  testID?: string;
}

/**
 * ReceiveQrCode component displays a scannable QR code for receiving payments.
 *
 * Features:
 * - High contrast (black on white) for reliable scanning
 * - Error correction level 'H' (high) for damaged QR tolerance
 * - Optional share button using React Native Share API
 * - Address displayed below QR code for manual copy
 */
export const ReceiveQrCode: React.FC<ReceiveQrCodeProps> = ({
  address,
  size = 220,
  onShare,
  testID = 'receive-qr-code',
}) => {
  // Truncate address for display (first 8 + last 4 characters)
  const truncatedAddress =
    address.length > 12 ? `${address.slice(0, 8)}...${address.slice(-4)}` : address;

  return (
    <div className="receive-qr-code" data-testid={testID}>
      {/* QR Code */}
      <div className="qr-code-container">
        <QRCode
          value={address}
          size={size}
          color="black"
          backgroundColor="white"
          ecl="H" // High error correction for better scanning
          logo={undefined} // No logo to maintain scan reliability
          logoSize={0}
          quietZone={10} // Quiet zone for better scanner recognition
        />
      </div>

      {/* Address Display */}
      <div className="address-display">
        <p className="address-label">Your Address</p>
        <p className="address-text" data-testid="address-text">
          {truncatedAddress}
        </p>
      </div>

      {/* Share Button */}
      {onShare && (
        <button onClick={onShare} className="share-button" data-testid="share-button">
          Share Address
        </button>
      )}
    </div>
  );
};
