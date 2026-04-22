import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { QRCode } from '@/components/QRCode';

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({
    value,
    size,
    'aria-label': ariaLabel,
  }: {
    value: string;
    size: number;
    'aria-label'?: string;
  }) => <svg data-testid="qr-code" data-value={value} data-size={size} aria-label={ariaLabel} />,
}));

describe('QRCode', () => {
  it('renders the QR code with the provided value', () => {
    render(<QRCode value="GABC123" />);

    expect(screen.getByTestId('qr-code')).toHaveAttribute('data-value', 'GABC123');
  });

  it('uses an accessible default label', () => {
    render(<QRCode value="GABC123" />);

    expect(screen.getByLabelText('QR code for address GABC123')).toBeInTheDocument();
  });

  it('supports a custom label and size', () => {
    render(<QRCode value="GABC123" label="Wallet QR" size={128} />);

    const qrCode = screen.getByLabelText('Wallet QR');
    expect(qrCode).toHaveAttribute('data-size', '128');
  });
});
