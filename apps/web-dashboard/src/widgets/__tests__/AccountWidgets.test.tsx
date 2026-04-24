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
  Loader2: () => <div data-testid="loader-icon" />,
  AlertCircle: () => <div data-testid="alert-icon" />,
}));

// Mock @ancore/ui-kit
vi.mock('@ancore/ui-kit', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardHeader: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardTitle: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardContent: ({ children, className }: any) => <div className={className}>{children}</div>,
}));

describe('Account Overview Widgets', () => {
  describe('BalanceWidget', () => {
    it('renders balance correctly', () => {
      render(<BalanceWidget balance={100.5} />);
      expect(screen.getByText('100.5 XLM')).toBeInTheDocument();
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
