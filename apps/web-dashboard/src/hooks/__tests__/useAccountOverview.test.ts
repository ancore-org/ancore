import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AccountNotFoundError,
  HorizonUnavailableError,
  useAccountOverview,
} from '../useAccountOverview';

describe('useAccountOverview', () => {
  const mockPublicKey = 'GBVFLP5J7XLTQBJX5QZW6LNRUZPGZRG7GMKQMVYOMKCFQG4N7VJ7RCV';

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches account data successfully', async () => {
    const mockAccountData = {
      balance: 100,
      nonce: 123456789,
      status: 'active',
    };

    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify(mockAccountData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { result } = renderHook(() => useAccountOverview(mockPublicKey));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });

    expect(result.current.data).toEqual({
      balance: 100,
      nonce: 123456789,
      status: 'active',
    });
    expect(result.current.error).toBeNull();
  });

  it('handles empty public key', async () => {
    const { result } = renderHook(() => useAccountOverview(''));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('handles Horizon API error', async () => {
    (global.fetch as any).mockResolvedValue(new Response(null, { status: 404 }));

    const { result } = renderHook(() => useAccountOverview(mockPublicKey));

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });

    expect(result.current.data).toBeNull();
    expect(result.current.error).not.toBeNull();
    expect(result.current.error).toBeInstanceOf(AccountNotFoundError);
  });

  it('allows refetch', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            balance: 50,
            nonce: 100,
            status: 'active',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            balance: 50,
            nonce: 100,
            status: 'active',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );

    const { result } = renderHook(() => useAccountOverview(mockPublicKey));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.balance).toBe(50);

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.data?.balance).toBe(50));
    expect(result.current.data?.balance).toBe(50);
  });

  it('maps 404 responses to account-not-found errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 404 }));

    const { result } = renderHook(() => useAccountOverview('GB...'));

    await waitFor(() => expect(result.current.error).toBeInstanceOf(AccountNotFoundError));
  });

  it('maps 500 responses to horizon-unavailable errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));

    const { result } = renderHook(() => useAccountOverview('GB...'));

    await waitFor(() => expect(result.current.error).toBeInstanceOf(HorizonUnavailableError));
  });

  it('recovers successfully after retry', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            balance: 9,
            nonce: 7,
            status: 'inactive',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );

    const { result } = renderHook(() => useAccountOverview('GB...'));

    await waitFor(() => expect(result.current.error).toBeInstanceOf(HorizonUnavailableError));

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.data).toEqual({
      balance: 9,
      nonce: 7,
      status: 'inactive',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
