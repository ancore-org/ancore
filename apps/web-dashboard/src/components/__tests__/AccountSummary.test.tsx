import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AccountSummary } from '../AccountSummary';
import type { AccountData } from '../../types/dashboard';

vi.mock('@ancore/ui-kit', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children, className }: any) => <div className={className}>{children}</div>,
  Badge: ({ children }: any) => <span>{children}</span>,
  AddressDisplay: ({ address }: any) => <span>{address}</span>,
}));

const MOCK_ACCOUNT: AccountData = {
  address: 'GABC...XYZ',
  balance: 500.5,
  status: 'active',
  lastActivity: new Date('2026-01-01'),
};

describe('AccountSummary', () => {
  it('renders address, balance, status, and last activity', () => {
    render(<AccountSummary account={MOCK_ACCOUNT} />);
    expect(screen.getByText('GABC...XYZ')).toBeInTheDocument();
    expect(screen.getByText('500.50 XLM')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('1/1/2026')).toBeInTheDocument();
  });

  it('renders inactive status', () => {
    render(<AccountSummary account={{ ...MOCK_ACCOUNT, status: 'inactive' }} />);
    expect(screen.getByText('inactive')).toBeInTheDocument();
  });
});
