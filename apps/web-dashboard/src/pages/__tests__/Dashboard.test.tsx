import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from '../Dashboard';
import { AccountNotFoundError, HorizonUnavailableError } from '../../hooks/useAccountOverview';

const mockUseAccountData = vi.fn();
const mockUseIndexerActivity = vi.fn();
const mockUseAccountOverview = vi.fn();

vi.mock('../../hooks/useAccountData', () => ({
  useAccountData: () => mockUseAccountData(),
}));

vi.mock('../../hooks/useIndexerActivity', () => ({
  useIndexerActivity: () => mockUseIndexerActivity(),
}));

vi.mock('../../hooks/useAccountOverview', async () => {
  const actual = await vi.importActual<typeof import('../../hooks/useAccountOverview')>(
    '../../hooks/useAccountOverview'
  );

  return {
    ...actual,
    useAccountOverview: () => mockUseAccountOverview(),
  };
});

vi.mock('../../components/AccountSummary', () => ({
  AccountSummary: () => <div>Account Summary</div>,
}));

vi.mock('../../components/TransactionList', () => ({
  TransactionList: () => <div>Transaction List</div>,
}));

vi.mock('../../widgets/AccountOverviewGrid', () => ({
  AccountOverviewGrid: () => <div>Overview Grid</div>,
}));

vi.mock('../../components/LoadingSkeletons', () => ({
  DashboardPageSkeleton: () => <div>Loading Dashboard</div>,
}));

describe('Dashboard', () => {
  beforeEach(() => {
    mockUseAccountData.mockReturnValue({
      account: {
        address: 'GABC...XYZ',
        balance: 100,
        status: 'active',
        lastActivity: new Date('2026-04-24T10:00:00Z'),
      },
      loading: false,
      error: null,
    });

    mockUseIndexerActivity.mockReturnValue({
      items: [],
      loading: false,
      error: null,
      loadMore: vi.fn(),
      hasMore: false,
    });

    mockUseAccountOverview.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('shows account-not-found copy for 404 failures', () => {
    mockUseAccountOverview.mockReturnValue({
      data: null,
      isLoading: false,
      error: new AccountNotFoundError(),
      refetch: vi.fn(),
    });

    render(<Dashboard />);

    expect(screen.getByRole('alert')).toHaveTextContent('Account not found');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This account does not exist on the selected network.'
    );
  });

  it('shows horizon outage copy for 500 failures and retries', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn().mockResolvedValue(undefined);

    mockUseAccountOverview.mockReturnValue({
      data: null,
      isLoading: false,
      error: new HorizonUnavailableError(),
      refetch,
    });

    render(<Dashboard />);

    expect(screen.getByRole('alert')).toHaveTextContent('Horizon is unavailable');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The Stellar Horizon service is temporarily unavailable. Please retry shortly.'
    );

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
  });
});
