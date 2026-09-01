import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from '../Dashboard';
import { AccountNotFoundError, HorizonUnavailableError } from '../../hooks/useAccountOverview';

const mockUseAccountData = vi.fn();
const mockUseIndexerActivity = vi.fn();
const mockUseAccountOverview = vi.fn();
const mockUseWalletConnection = vi.fn();
const mockUseAccountState = vi.fn();

const CONNECTED_ADDRESS = 'CACCOUNT7NPZQZQKDVQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const SELECTED_ADDRESS = 'GSELECTED4444444444444444444444444444444444444444444444';

vi.mock('../../hooks/useAccountData', () => ({
  useAccountData: (address: string) => mockUseAccountData(address),
}));

vi.mock('../../hooks/useWalletConnection', () => ({
  useWalletConnection: () => mockUseWalletConnection(),
}));

vi.mock('../../hooks/useAccountState', () => ({
  useAccountState: () => mockUseAccountState(),
}));

vi.mock('../../hooks/useIndexerActivity', () => ({
  useIndexerActivity: (accountId: string) => mockUseIndexerActivity(accountId),
}));

vi.mock('../../hooks/useAccountOverview', async () => {
  const actual = await vi.importActual<typeof import('../../hooks/useAccountOverview')>(
    '../../hooks/useAccountOverview'
  );

  return {
    ...actual,
    useAccountOverview: (publicKey: string) => mockUseAccountOverview(publicKey),
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
    mockUseWalletConnection.mockReturnValue({
      connected: true,
      smartAccountId: CONNECTED_ADDRESS,
      ownerPublicKey: null,
      connecting: false,
      error: null,
      extensionInstalled: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      refresh: vi.fn(),
    });

    mockUseAccountState.mockReturnValue({
      accounts: [],
      currentAccount: null,
      setCurrentAccount: vi.fn(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

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

  // ── #1322: the page must query the real account ────────────────────────────
  //
  // Every data source here used to be wired to a hardcoded `DEFAULT_ADDRESS`
  // of 'GABC...XYZ' — not even a well-formed 56-character StrKey — so the
  // primary landing page never looked at the signed-in user's account.

  it('queries all three data sources with the connected wallet address', () => {
    render(<Dashboard />);

    expect(mockUseAccountData).toHaveBeenCalledWith(CONNECTED_ADDRESS);
    expect(mockUseAccountOverview).toHaveBeenCalledWith(CONNECTED_ADDRESS);
    expect(mockUseIndexerActivity).toHaveBeenCalledWith(CONNECTED_ADDRESS);
  });

  it('never queries a placeholder address', () => {
    render(<Dashboard />);

    for (const mock of [mockUseAccountData, mockUseAccountOverview, mockUseIndexerActivity]) {
      for (const [address] of mock.mock.calls) {
        expect(address).not.toContain('...');
      }
    }
  });

  it('falls back to the selected dashboard account when no wallet is connected', () => {
    mockUseWalletConnection.mockReturnValue({
      connected: false,
      smartAccountId: null,
      ownerPublicKey: null,
      connecting: false,
      error: null,
      extensionInstalled: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      refresh: vi.fn(),
    });
    mockUseAccountState.mockReturnValue({
      accounts: [],
      currentAccount: { address: SELECTED_ADDRESS, balance: 0, status: 'active' },
      setCurrentAccount: vi.fn(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<Dashboard />);

    expect(mockUseAccountData).toHaveBeenCalledWith(SELECTED_ADDRESS);
  });

  it('prompts for a wallet instead of rendering an empty dashboard when there is no account', () => {
    mockUseWalletConnection.mockReturnValue({
      connected: false,
      smartAccountId: null,
      ownerPublicKey: null,
      connecting: false,
      error: null,
      extensionInstalled: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      refresh: vi.fn(),
    });

    render(<Dashboard />);

    expect(screen.getByText('Connect a wallet to view your dashboard')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect wallet' })).toBeInTheDocument();
    // Notably not the skeleton: with no address the data hooks never clear
    // their initial loading flag, so the page would otherwise hang on it.
    expect(screen.queryByText('Loading Dashboard')).not.toBeInTheDocument();
  });

  it('connects the wallet when the prompt is used', async () => {
    const user = userEvent.setup();
    const connect = vi.fn().mockResolvedValue(undefined);
    mockUseWalletConnection.mockReturnValue({
      connected: false,
      smartAccountId: null,
      ownerPublicKey: null,
      connecting: false,
      error: null,
      extensionInstalled: true,
      connect,
      disconnect: vi.fn(),
      refresh: vi.fn(),
    });

    render(<Dashboard />);
    await user.click(screen.getByRole('button', { name: 'Connect wallet' }));

    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
  });

  it('tells the user to install the extension when it is absent', () => {
    mockUseWalletConnection.mockReturnValue({
      connected: false,
      smartAccountId: null,
      ownerPublicKey: null,
      connecting: false,
      error: null,
      extensionInstalled: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      refresh: vi.fn(),
    });

    render(<Dashboard />);

    expect(screen.getByText(/Install the Ancore browser extension/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Connect wallet' })).not.toBeInTheDocument();
  });
});
