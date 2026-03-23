import { render, screen } from '@testing-library/react';

import React from 'react';
import { StellarQRCode } from '../components/QRCode';

describe('StellarQRCode', () => {
  it('renders a QR code for a Stellar address', () => {
    render(<StellarQRCode address="GABCD1234EXAMPLEADDRESS" />);
    const qr = screen.getByRole('img');
    expect(qr).toBeInTheDocument();
    expect(qr).toHaveAttribute('aria-label', expect.stringContaining('GABCD1234EXAMPLEADDRESS'));
  });
});
