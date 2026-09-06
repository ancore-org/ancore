import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { vi } from 'vitest';
import { useAccountState } from '../useAccountState';
import type { WalletConnectionState } from '../useWalletConnection';

// useAccountState (#1384) is driven by useWalletConnection + a fetch to
// /api/account-overview rather than a hardcoded account list, so both are
// mocked here to keep the hook's own logic under test deterministic.
const mockUseWalletConnection = vi.fn<() => WalletConnectionState>();
vi.mock('../useWalletConnection', () => ({
  useWalletConnection: () => mockUseWalletConnection(),
}));

const CONNECTED_ADDRESS = 'GABC123DEF456GHI789JKL012MNO345PQR678STU901VWX234YZ';

function connectedWalletState(
  overrides: Partial<WalletConnectionState> = {}
): WalletConnectionState {
  return {
    connected: true,
    smartAccountId: CONNECTED_ADDRESS,
    ownerPublicKey: null,
    connecting: false,
    error: null,
    extensionInstalled: true,
    ...overrides,
  };
}

function disconnectedWalletState(): WalletConnectionState {
  return {
    connected: false,
    smartAccountId: null,
    ownerPublicKey: null,
    connecting: false,
    error: null,
    extensionInstalled: false,
  };
}

function mockFetchOnce(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  });
}

// Mock localStorage
const originalLocalStorage = window.localStorage;
let store: Record<string, string> = {};

const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    store = {};
  }),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  configurable: true,
});

describe('useAccountState', () => {
  beforeEach(() => {
    store = {};
    localStorageMock.setItem.mockImplementation((key: string, value: string) => {
      store[key] = value;
    });
    localStorageMock.getItem.mockImplementation((key: string) => store[key] || null);
    localStorageMock.removeItem.mockImplementation((key: string) => {
      delete store[key];
    });
    vi.clearAllMocks();
    mockUseWalletConnection.mockReturnValue(connectedWalletState());
  });

  afterAll(() => {
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      configurable: true,
    });
  });

  it('loads accounts and sets default current account on initial load', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ balance: 1250.75, status: 'active' }));

    const { result } = renderHook(() => useAccountState());

    expect(result.current.loading).toBe(true);
    expect(result.current.accounts).toEqual([]);
    expect(result.current.currentAccount).toBe(null);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.accounts).toHaveLength(1);
      expect(result.current.currentAccount?.address).toBe(CONNECTED_ADDRESS);
      expect(result.current.currentAccount?.balance).toBe(1250.75);
    });

    vi.unstubAllGlobals();
  });

  it('clears account state when no wallet is connected', async () => {
    mockUseWalletConnection.mockReturnValue(disconnectedWalletState());

    const { result } = renderHook(() => useAccountState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.accounts).toEqual([]);
    expect(result.current.currentAccount).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('persists the fetched account to localStorage', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ balance: 845.2, status: 'active' }));

    const { result } = renderHook(() => useAccountState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.currentAccount?.address).toBe(CONNECTED_ADDRESS);
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'ancore-dashboard-selected-account',
      expect.stringContaining(CONNECTED_ADDRESS)
    );

    vi.unstubAllGlobals();
  });

  it('sets an error and clears accounts when the fetch response is not ok', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({}, false));

    const { result } = renderHook(() => useAccountState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).not.toBe(null);
    });

    expect(result.current.accounts).toEqual([]);
    expect(result.current.currentAccount).toBe(null);

    vi.unstubAllGlobals();
  });

  it('updates current account and saves to localStorage', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ balance: 1250.75, status: 'active' }));

    const { result } = renderHook(() => useAccountState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const otherAccount = {
      address: 'GDEF789GHI012JKL345MNO678PQR901STU234VWX567YZA890BCD',
      balance: 500,
      status: 'active' as const,
      lastActivity: new Date(),
    };

    act(() => {
      result.current.setCurrentAccount(otherAccount);
    });

    expect(result.current.currentAccount?.address).toBe(otherAccount.address);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'ancore-dashboard-selected-account',
      expect.stringContaining(otherAccount.address)
    );

    vi.unstubAllGlobals();
  });

  it('handles localStorage errors gracefully', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ balance: 1250.75, status: 'active' }));
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('localStorage not available');
    });

    const { result } = renderHook(() => useAccountState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.currentAccount).not.toBe(null);
    });

    expect(() => {
      act(() => {
        result.current.setCurrentAccount(result.current.currentAccount!);
      });
    }).not.toThrow();

    vi.unstubAllGlobals();
  });

  it('refetch function reloads account data', async () => {
    const fetchMock = mockFetchOnce({ balance: 1250.75, status: 'active' });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAccountState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.accounts).toHaveLength(1);
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.accounts).toHaveLength(1);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.unstubAllGlobals();
  });

  it('returns correct hook interface', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ balance: 1250.75, status: 'active' }));

    const { result } = renderHook(() => useAccountState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(Array.isArray(result.current.accounts)).toBe(true);
    expect(typeof result.current.setCurrentAccount).toBe('function');
    expect(typeof result.current.loading).toBe('boolean');
    expect(typeof result.current.refetch).toBe('function');

    vi.unstubAllGlobals();
  });
});
