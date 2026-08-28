import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountOverviewGrid } from '../AccountOverviewGrid';

vi.mock('lucide-react', () => ({
  AlertCircle: () => <div data-testid="alert-icon" />,
  RefreshCw: () => <div data-testid="refresh-icon" />,
  Wallet: () => <div data-testid="wallet-icon" />,
  Hash: () => <div data-testid="hash-icon" />,
  ShieldCheck: () => <div data-testid="shield-check-icon" />,
  ShieldAlert: () => <div data-testid="shield-alert-icon" />,
  Shield: () => <div data-testid="shield-icon" />,
}));

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

vi.mock('../../hooks/useAccountOverview', () => ({
  useAccountOverview: () => ({
    data: { balance: 100.5, nonce: 42, status: 'active' },
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../OnboardingHints', () => ({
  OnboardingHints: () => <div data-testid="onboarding-hints" />,
}));

const balanceShouldThrow = vi.fn(() => false);

vi.mock('../AccountWidgets', async () => {
  const actual = await vi.importActual<typeof import('../AccountWidgets')>('../AccountWidgets');
  return {
    ...actual,
    BalanceWidget: (props: any) => {
      if (balanceShouldThrow()) {
        throw new Error('Unexpected balance widget crash');
      }
      return actual.BalanceWidget(props);
    },
  };
});

describe('AccountOverviewGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    balanceShouldThrow.mockReturnValue(false);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders overview widgets when healthy', () => {
    render(
      <AccountOverviewGrid publicKey="GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" />
    );

    expect(screen.getByText('Total Balance')).toBeInTheDocument();
    expect(screen.getByText('Account Nonce')).toBeInTheDocument();
    expect(screen.getByText('Account Status')).toBeInTheDocument();
    expect(screen.getByText('100.50 XLM')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('catches unhandled throw inside WidgetErrorBoundary and allows retry', () => {
    balanceShouldThrow.mockReturnValue(true);

    render(
      <AccountOverviewGrid publicKey="GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" />
    );

    expect(screen.getByText('Widget Failed')).toBeInTheDocument();
    expect(screen.getByText('Unexpected balance widget crash')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();

    // Sibling widgets stay mounted
    expect(screen.getByText('Account Nonce')).toBeInTheDocument();
    expect(screen.getByText('Account Status')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    balanceShouldThrow.mockReturnValue(false);
    fireEvent.click(retryBtn);

    expect(screen.queryByText('Widget Failed')).not.toBeInTheDocument();
    expect(screen.getByText('Total Balance')).toBeInTheDocument();
    expect(screen.getByText('100.50 XLM')).toBeInTheDocument();
  });
});
