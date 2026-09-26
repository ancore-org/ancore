import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountData } from '../useAccountData';

describe('useAccountData', () => {
  const mockAddress = 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns loading initially', () => {
    (global.fetch as any).mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useAccountData(mockAddress));
    expect(result.current.loading).toBe(true);
    expect(result.current.account).toBeNull();
  });

  it('fetches real account data from Horizon successfully', async () => {
    const mockHorizonData = {
      id: mockAddress,
      account_id: mockAddress,
      balances: [
        { asset_type: 'native', balance: '250.7500000' },
        { asset_type: 'credit_alphanum4', asset_code: 'USDC', balance: '10.00' },
      ],
      sequence: '100',
      subentry_count: 2,
      last_modified_ledger: 500,
      last_modified_time: '2026-04-24T10:00:00Z',
    };

    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify(mockHorizonData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { result } = renderHook(() => useAccountData(mockAddress));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.account).toEqual({
      address: mockAddress,
      balance: 250.75,
      status: 'active',
      lastActivity: new Date('2026-04-24T10:00:00Z'),
    });
    expect(result.current.transactions).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('handles unfunded/404 account gracefully', async () => {
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ status: 404, title: 'Resource Missing' }), {
        status: 404,
        statusText: 'Not Found',
      })
    );

    const { result } = renderHook(() => useAccountData(mockAddress));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.account).toEqual({
      address: mockAddress,
      balance: 0,
      status: 'unfunded',
      lastActivity: expect.any(Date),
    });
    expect(result.current.transactions).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('handles network or Horizon server error', async () => {
    (global.fetch as any).mockResolvedValue(
      new Response('Internal Error', {
        status: 500,
        statusText: 'Internal Server Error',
      })
    );

    const { result } = renderHook(() => useAccountData(mockAddress));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.account).toBeNull();
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toContain('Horizon error: 500');
  });

  it('does not fetch when address is empty', () => {
    const { result } = renderHook(() => useAccountData(''));
    expect(result.current.loading).toBe(true);
    expect(result.current.account).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('supports refetching account data', async () => {
    const mockData1 = {
      id: mockAddress,
      account_id: mockAddress,
      balances: [{ asset_type: 'native', balance: '100.0000000' }],
      sequence: '101',
      subentry_count: 0,
      last_modified_ledger: 501,
      last_modified_time: '2026-04-24T10:00:00Z',
    };

    const mockData2 = {
      id: mockAddress,
      account_id: mockAddress,
      balances: [{ asset_type: 'native', balance: '300.0000000' }],
      sequence: '102',
      subentry_count: 0,
      last_modified_ledger: 502,
      last_modified_time: '2026-04-24T11:00:00Z',
    };

    (global.fetch as any)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockData1), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockData2), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    const { result } = renderHook(() => useAccountData(mockAddress));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.account?.balance).toBe(100);

    await act(async () => {
      result.current.refetch();
    });

    await waitFor(() => expect(result.current.account?.balance).toBe(300));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
