import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BalanceWidget, NonceWidget, AccountStatusWidget } from '../AccountWidgets';
import React from 'react';

// Mock lucide-react to avoid issues with SVG rendering in tests
vi.mock('lucide-react', () => ({
  Wallet: () => <div data-testid="wallet-icon" />,
  Hash: () => <div data-testid="hash-icon" />,
  ShieldCheck: () => <div data-testid="shield-check-icon" />,
  ShieldAlert: () => <div data-testid="shield-alert-icon" />,
  Shield: () => <div data-testid="shield-icon" />,
  AlertCircle: () => <div data-testid="alert-icon" />,
}));

// Mock @ancore/ui-kit
vi.mock('@ancore/ui-kit', () => ({
  Card: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>
      {children}
    </div>
  ),
  CardHeader: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>
      {children}
    </div>
  ),
  CardTitle: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>
      {children}
    </div>
  ),
  Skeleton: ({ className, ...props }: any) => (
    <div className={className} aria-hidden="true" {...props} />
  ),
}));

describe('Account Overview Widgets', () => {
  describe('BalanceWidget', () => {
    it('renders balance correctly', () => {
      render(<BalanceWidget balance={100.5} />);
      expect(screen.getByText('100.50 XLM')).toBeInTheDocument();
      expect(screen.getByText('Total Balance')).toBeInTheDocument();
    });

    it('renders zero balance correctly', () => {
      render(<BalanceWidget balance={0} />);
      expect(screen.getByText('0.00 XLM')).toBeInTheDocument();
    });

    it('renders loading state', () => {
      render(<BalanceWidget isLoading={true} />);
      expect(screen.getByTestId('metric-loading')).toBeInTheDocument();
    });

    it('renders error state', () => {
      render(<BalanceWidget error={new Error('Test error')} />);
      expect(screen.getByTestId('metric-error')).toBeInTheDocument();
      expect(screen.getByText('Error loading data')).toBeInTheDocument();
    });
  });

  describe('NonceWidget', () => {
    it('renders nonce correctly', () => {
      render(<NonceWidget nonce={42} />);
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('Account Nonce')).toBeInTheDocument();
    });

    it('renders zero nonce correctly', () => {
      render(<NonceWidget nonce={0} />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('renders missing data as dash', () => {
      render(<NonceWidget />);
      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });

  describe('Partial Data Rendering', () => {
    it('renders dash when balance is missing but other props are provided', () => {
      render(<BalanceWidget balance={undefined} isLoading={false} />);
      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('renders dash when nonce is missing', () => {
      render(<NonceWidget nonce={undefined} />);
      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });

  describe('AccountStatusWidget', () => {
    it('renders active status', () => {
      render(<AccountStatusWidget status="active" />);
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByTestId('shield-check-icon')).toBeInTheDocument();
    });

    it('renders locked status', () => {
      render(<AccountStatusWidget status="locked" />);
      expect(screen.getByText('Locked')).toBeInTheDocument();
      expect(screen.getByTestId('shield-alert-icon')).toBeInTheDocument();
    });

    it('renders loading state', () => {
      render(<AccountStatusWidget isLoading={true} />);
      expect(screen.getByTestId('metric-loading')).toBeInTheDocument();
    });
  });
});

// ─── Skeleton tests ───────────────────────────────────────────────────────────

import {
  AccountOverviewSkeleton,
  TransactionListSkeleton,
  BalanceChartSkeleton,
  SessionKeysSkeleton,
  MultiSigSkeleton,
  InvoiceListSkeleton,
  DashboardPageSkeleton,
} from '../../components/LoadingSkeletons';

describe('Loading Skeletons', () => {
  it('AccountOverviewSkeleton renders with default testid', () => {
    render(<AccountOverviewSkeleton />);
    expect(screen.getByTestId('overview-skeleton')).toBeInTheDocument();
  });

  it('AccountOverviewSkeleton accepts custom testid', () => {
    render(<AccountOverviewSkeleton data-testid="custom-overview" />);
    expect(screen.getByTestId('custom-overview')).toBeInTheDocument();
  });

  it('TransactionListSkeleton renders with default testid', () => {
    render(<TransactionListSkeleton />);
    expect(screen.getByTestId('transaction-list-skeleton')).toBeInTheDocument();
  });

  it('BalanceChartSkeleton renders with default testid', () => {
    render(<BalanceChartSkeleton />);
    expect(screen.getByTestId('balance-chart-skeleton')).toBeInTheDocument();
  });

  it('SessionKeysSkeleton renders with default testid', () => {
    render(<SessionKeysSkeleton />);
    expect(screen.getByTestId('session-keys-skeleton')).toBeInTheDocument();
  });

  it('MultiSigSkeleton renders with default testid', () => {
    render(<MultiSigSkeleton />);
    expect(screen.getByTestId('multi-sig-skeleton')).toBeInTheDocument();
  });

  it('InvoiceListSkeleton renders with default testid', () => {
    render(<InvoiceListSkeleton />);
    expect(screen.getByTestId('invoice-list-skeleton')).toBeInTheDocument();
  });

  it('DashboardPageSkeleton renders with dashboard-skeleton testid', () => {
    render(<DashboardPageSkeleton />);
    expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument();
  });
});
