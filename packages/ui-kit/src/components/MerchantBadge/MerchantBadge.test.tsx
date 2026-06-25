import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { MerchantBadge, type MerchantBadgeStatus } from './MerchantBadge';

const cases: Array<[MerchantBadgeStatus, string, string]> = [
  ['verified', 'Verified', 'Acme merchant verification: Verified'],
  ['pending', 'Pending review', 'Acme merchant verification: Pending review'],
  ['unverified', 'Unverified', 'Acme merchant verification: Unverified'],
];

describe('MerchantBadge', () => {
  it.each(cases)('renders the %s state with an accessible name', (status, label, name) => {
    render(<MerchantBadge merchantName="Acme" status={status} />);

    expect(screen.getByRole('status', { name })).toBeInTheDocument();
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('falls back to unknown for missing status metadata', () => {
    render(<MerchantBadge merchantName="Legacy Merchant" status={null} />);

    expect(
      screen.getByRole('status', { name: 'Legacy Merchant merchant verification: Unknown' })
    ).toBeInTheDocument();
    expect(screen.getByText(/merchant verification status is unavailable/i)).toBeInTheDocument();
  });
});
