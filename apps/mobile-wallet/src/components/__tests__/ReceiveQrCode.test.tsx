import React from 'react';
import { render, screen } from '@testing-library/react';

import { ReceiveQrCode } from '../ReceiveQrCode';

// Mock react-native-qrcode-svg
jest.mock('react-native-qrcode-svg', () => {
  return function MockQRCode({ value, size }: { value: string; size: number }) {
    return (
      <div data-testid="qr-code-svg" data-value={value} data-size={size}>
        QR Code
      </div>
    );
  };
});

describe('ReceiveQrCode', () => {
  const mockAddress = 'GABC1234567890DEF1234567890DEF1234567890DEF1234567890DEF';

  it('renders QR code with given address', () => {
    render(<ReceiveQrCode address={mockAddress} />);

    const qrCodeContainer = screen.getByTestId('receive-qr-code');
    const qrCodeSvg = screen.getByTestId('qr-code-svg');
    expect(qrCodeContainer).toBeDefined();
    expect(qrCodeSvg).toBeDefined();
    expect(qrCodeSvg.getAttribute('data-value')).toBe(mockAddress);
  });

  it('displays truncated address', () => {
    render(<ReceiveQrCode address={mockAddress} />);

    const addressText = screen.getByTestId('address-text');
    expect(addressText).toBeDefined();
    // Should show first 8, ..., last 4
    expect(addressText.textContent).toBe('GABC1234...0DEF');
  });

  it('displays full address when shorter than 12 characters', () => {
    const shortAddress = 'GABC123';
    render(<ReceiveQrCode address={shortAddress} />);

    const addressText = screen.getByTestId('address-text');
    expect(addressText.textContent).toBe(shortAddress);
  });

  it('renders share button when onShare callback is provided', () => {
    const onShare = jest.fn();
    render(<ReceiveQrCode address={mockAddress} onShare={onShare} />);

    const shareButton = screen.getByTestId('share-button');
    expect(shareButton).toBeDefined();
  });

  it('does not render share button when onShare callback is not provided', () => {
    render(<ReceiveQrCode address={mockAddress} />);

    const shareButton = screen.queryByTestId('share-button');
    expect(shareButton).toBeNull();
  });

  it('calls onShare when share button is clicked', () => {
    const onShare = jest.fn();
    render(<ReceiveQrCode address={mockAddress} onShare={onShare} />);

    const shareButton = screen.getByTestId('share-button');
    shareButton.click();

    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it('uses custom test ID when provided', () => {
    const customTestID = 'custom-qr-code';
    render(<ReceiveQrCode address={mockAddress} testID={customTestID} />);

    const qrCodeContainer = screen.getByTestId(customTestID);
    expect(qrCodeContainer).toBeDefined();
  });

  it('renders with default size when not specified', () => {
    render(<ReceiveQrCode address={mockAddress} />);

    const qrCodeSvg = screen.getByTestId('qr-code-svg');
    expect(qrCodeSvg.getAttribute('data-size')).toBe('220');
  });

  it('renders with custom size when specified', () => {
    render(<ReceiveQrCode address={mockAddress} size={300} />);

    const qrCodeSvg = screen.getByTestId('qr-code-svg');
    expect(qrCodeSvg.getAttribute('data-size')).toBe('300');
  });
});
