import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSendFeeEstimate } from '../useSendFeeEstimate';

const VALID_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

describe('useSendFeeEstimate', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns initial state when disabled', () => {
    const { result } = renderHook(() =>
      useSendFeeEstimate(VALID_ADDRESS, '10', { disabled: true })
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.fee).toBe('0.0000100');
    expect(result.current.error).toBeNull();
  });

  it('returns initial state when recipient is empty', () => {
    const { result } = renderHook(() => useSendFeeEstimate('', '10'));

    expect(result.current.loading).toBe(false);
    expect(result.current.fee).toBe('0.0000100');
  });

  it('returns initial state when amount is empty', () => {
    const { result } = renderHook(() => useSendFeeEstimate(VALID_ADDRESS, ''));

    expect(result.current.loading).toBe(false);
    expect(result.current.fee).toBe('0.0000100');
  });

  it('returns initial state when amount is zero or negative', () => {
    const { result } = renderHook(() => useSendFeeEstimate(VALID_ADDRESS, '0'));
    expect(result.current.fee).toBe('0.0000100');

    const { result: result2 } = renderHook(() => useSendFeeEstimate(VALID_ADDRESS, '-5'));
    expect(result2.current.fee).toBe('0.0000100');
  });

  it('debounces estimation requests', async () => {
    vi.stubGlobal('fetch', vi.fn());

    const { result } = renderHook(
      ({ recipient, amount }) => useSendFeeEstimate(recipient, amount, { debounceMs: 100 }),
      { initialProps: { recipient: VALID_ADDRESS, amount: '10' } }
    );

    // Should not have started loading yet (debounced)
    expect(result.current.loading).toBe(false);

    // Advance past debounce
    await vi.advanceTimersByTimeAsync(200);

    // After debounce, should attempt estimation
    // Since network call will fail (no real Stellar node), it falls back to defaults
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('returns default fee on estimation error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('Network error')))
    );

    const { result } = renderHook(() => useSendFeeEstimate(VALID_ADDRESS, '10', { debounceMs: 0 }));

    await vi.advanceTimersByTimeAsync(100);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.fee).toBe('0.0000100');
    expect(result.current.minBalance).toBe('0.0050100');
  });

  it('handles unparseable fee as an error state', async () => {
    vi.mock('@ancore/stellar', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@ancore/stellar')>();
      return {
        ...actual,
        createStellarClient: () => ({
          simulateTransaction: vi.fn().mockResolvedValue({ fee: 'not-a-number' }),
        }),
      };
    });

    const { useSendFeeEstimate } = await import('../useSendFeeEstimate');
    const { result } = renderHook(() => useSendFeeEstimate(VALID_ADDRESS, '10', { debounceMs: 0 }));

    await vi.advanceTimersByTimeAsync(100);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.fee).toBe('0.0000100');
    expect(result.current.minBalance).toBe('0.0050100');
    expect(result.current.error).toBe('fee unavailable');

    vi.doUnmock('@ancore/stellar');
  });
});
