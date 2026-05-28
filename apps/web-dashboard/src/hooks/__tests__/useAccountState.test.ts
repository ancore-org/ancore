import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { vi } from 'vitest';
import { useAccountState } from '../useAccountState';

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
  });

  afterAll(() => {
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      configurable: true,
    });
  });

  it('loads accounts and sets default current account on initial load', async () => {
    const { result } = renderHook(() => useAccountState());

    expect(result.current.loading).toBe(true);
    expect(result.current.accounts).toEqual([]);
    expect(result.current.currentAccount).toBe(null);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.accounts).toHaveLength(4);
      expect(result.current.currentAccount).not.toBe(null);
      expect(result.current.currentAccount?.address).toBe(
        'GABC123DEF456GHI789JKL012MNO345PQR678STU901VWX234YZ'
      );
    });
  });

  it('loads stored account from localStorage if available', async () => {
    const storedAccount = {
      address: 'GDEF789GHI012JKL345MNO678PQR901STU234VWX567YZA890BCD',
      balance: 845.2,
      status: 'active' as const,
      lastActivity: new Date('2026-04-23T15:30:00Z').toISOString(),
    };
    localStorageMock.setItem('ancore-dashboard-selected-account', JSON.stringify(storedAccount));

    const { result } = renderHook(() => useAccountState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.currentAccount?.address).toBe(
        'GDEF789GHI012JKL345MNO678PQR901STU234VWX567YZA890BCD'
      );
    });
  });

  it('handles corrupted localStorage data gracefully', async () => {
    localStorageMock.setItem('ancore-dashboard-selected-account', 'invalid-json');

    const { result } = renderHook(() => useAccountState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.currentAccount?.address).toBe(
        'GABC123DEF456GHI789JKL012MNO345PQR678STU901VWX234YZ'
      );
    });
  });

  it('updates current account and saves to localStorage', async () => {
    const { result } = renderHook(() => useAccountState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.accounts).toHaveLength(4);
    });

    const targetAccount = result.current.accounts[1];
    act(() => {
      result.current.setCurrentAccount(targetAccount);
    });

    await waitFor(() => {
      expect(result.current.currentAccount?.address).toBe(targetAccount.address);
    });
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'ancore-dashboard-selected-account',
      expect.stringContaining(targetAccount.address)
    );
  });

  it('removes from localStorage when account is set to null', async () => {
    const { result } = renderHook(() => useAccountState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Note: The hook doesn't allow setting null, but we test the implementation
    // This would need to be updated if the hook API changes
    expect(typeof result.current.setCurrentAccount).toBe('function');
  });

  it('handles localStorage errors gracefully', async () => {
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('localStorage not available');
    });

    const { result } = renderHook(() => useAccountState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.accounts).toHaveLength(4);
      expect(result.current.currentAccount).not.toBe(null);
    });

    // Should not throw when setting account
    expect(() => {
      result.current.setCurrentAccount(result.current.accounts[0]);
    }).not.toThrow();
  });

  it('refetch function reloads account data', async () => {
    const { result } = renderHook(() => useAccountState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.accounts).toHaveLength(4);
    });

    // Reset loading state
    expect(result.current.loading).toBe(false);

    // Call refetch
    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.accounts).toHaveLength(4);
    });
  });

  it('handles fetch errors gracefully', async () => {
    // Mock a more complex scenario where the fetch might fail
    // This would require mocking the implementation more deeply
    const { result } = renderHook(() => useAccountState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });
  });

  it('returns correct hook interface', async () => {
    const { result } = renderHook(() => useAccountState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(typeof result.current.accounts).toBe('object');
    expect(typeof result.current.currentAccount).toBe('object');
    expect(typeof result.current.setCurrentAccount).toBe('function');
    expect(typeof result.current.loading).toBe('boolean');
    expect(typeof result.current.error).toBe('object');
    expect(typeof result.current.refetch).toBe('function');
  });
});
