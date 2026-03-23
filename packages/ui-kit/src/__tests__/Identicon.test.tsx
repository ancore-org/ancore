import { render, screen } from '@testing-library/react';

import { Identicon } from '../components/Identicon';
import React from 'react';

describe('Identicon', () => {
  it('renders a deterministic identicon for an address', () => {
    render(<Identicon address="GABCD1234EXAMPLEADDRESS" />);
    const icon = screen.getByRole('img');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('aria-label', expect.stringContaining('GABCD1234EXAMPLEADDRESS'));
  });
});
