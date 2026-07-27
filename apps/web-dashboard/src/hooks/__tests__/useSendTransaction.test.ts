import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSendTransaction } from '../useSendTransaction';
import type { SendStrategy, SendResult } from '../../services/send-service';

const VALID_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const fastOptions = { submitDelayMs: 0, confirmationDelayMs: 0 };

// ---------------------------------------------------------------------------
// Mock strategy
// ---------------------------------------------------------------------------

function createMockStrategy(overrides?: Partial<SendStrategy>): SendStrategy {
  return {
    name: 'wallet-api',
    isAvailable: vi.fn(async () => true),
    estimateFee: vi.fn(async () => ({
      baseFee: '0.0000100',
      minBalance: '0.0050100',
    })),
    send: vi.fn(
      async (): Promise<SendResult> => ({
        status: 'submitted',
        hash: `mock-hash-${Date.now()}`,
      })
    ),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSendTransaction', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // --- Demo mode (original behavior) ---

  it('initializes with no optimistic transaction', () => {
    const { result } = renderHook(() => useSendTransaction({ ...fastOptions, demoMode: true }));
    expect(result.current.optimisticTransaction).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('creates optimistic transaction immediately on send in demo mode', async () => {
    const { result } = renderHook(() => useSendTransaction({ ...fastOptions, demoMode: true }));

    await act(async () => {
      await result.current.sendTransaction({ recipient: VALID_ADDRESS, amount: 100 });
    });

    expect(result.current.optimisticTransaction).not.toBeNull();
    expect(result.current.optimisticTransaction?.type).toBe('send');
    expect(result.current.optimisticTransaction?.amount).toBe(100);
    expect(result.current.optimisticTransaction?.counterparty).toBe(VALID_ADDRESS);
    expect(result.current.optimisticTransaction?.status).toBe('confirmed');
  });

  it('handles transaction submission in demo mode', async () => {
    const { result } = renderHook(() => useSendTransaction({ ...fastOptions, demoMode: true }));

    await act(async () => {
      const tx = await result.current.sendTransaction({
        recipient: VALID_ADDRESS,
        amount: 50,
      });

      expect(tx.type).toBe('send');
      expect(tx.amount).toBe(50);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
  });

  it('clears optimistic transaction on demand', async () => {
    const { result } = renderHook(() => useSendTransaction({ ...fastOptions, demoMode: true }));

    await act(async () => {
      await result.current.sendTransaction({ recipient: VALID_ADDRESS, amount: 100 });
    });

    await waitFor(() => {
      expect(result.current.optimisticTransaction).not.toBeNull();
    });

    act(() => {
      result.current.clearOptimistic();
    });

    expect(result.current.optimisticTransaction).toBeNull();
  });

  it('rolls back optimistic transaction', async () => {
    const { result } = renderHook(() => useSendTransaction({ ...fastOptions, demoMode: true }));

    await act(async () => {
      await result.current.sendTransaction({ recipient: VALID_ADDRESS, amount: 100 });
    });

    await waitFor(() => {
      expect(result.current.optimisticTransaction).not.toBeNull();
    });

    act(() => {
      result.current.rollback();
    });

    expect(result.current.optimisticTransaction).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('resolves @username handles before sending', async () => {
    const resolveHandle = vi.fn(async () => ({
      handle: '@alice' as const,
      accountAddress: VALID_ADDRESS,
      displayName: 'Alice',
    }));
    const { result } = renderHook(() =>
      useSendTransaction({ ...fastOptions, demoMode: true, resolveHandle })
    );

    await act(async () => {
      await result.current.sendTransaction({ recipient: '@Alice', amount: 25 });
    });

    expect(resolveHandle).toHaveBeenCalledWith('@alice');
    expect(result.current.resolvedRecipient?.accountAddress).toBe(VALID_ADDRESS);
    expect(result.current.optimisticTransaction?.counterparty).toBe(VALID_ADDRESS);
  });

  it('surfaces a clear error when a handle is not found', async () => {
    const { result } = renderHook(() =>
      useSendTransaction({
        ...fastOptions,
        demoMode: true,
        resolveHandle: vi.fn(async () => null),
      })
    );

    await act(async () => {
      await expect(
        result.current.sendTransaction({ recipient: '@missing', amount: 10 })
      ).rejects.toThrow('Handle not found');
    });

    expect(result.current.recipientError).toBe('Handle not found');
    expect(result.current.optimisticTransaction).toBeNull();
  });

  it('provides lifecycle management methods', () => {
    const { result } = renderHook(() => useSendTransaction({ ...fastOptions, demoMode: true }));

    expect(typeof result.current.sendTransaction).toBe('function');
    expect(typeof result.current.clearOptimistic).toBe('function');
    expect(typeof result.current.rollback).toBe('function');
  });

  // --- Real strategy mode ---

  it('uses real strategy when sendStrategy is provided', async () => {
    const mockStrategy = createMockStrategy();
    const { result } = renderHook(() =>
      useSendTransaction({ sendStrategy: mockStrategy, network: 'testnet' })
    );

    await act(async () => {
      await result.current.sendTransaction({ recipient: VALID_ADDRESS, amount: 10 });
    });

    expect(mockStrategy.send).toHaveBeenCalledWith({
      recipient: VALID_ADDRESS,
      amount: '10',
    });
  });

  it('sets status to pending after real submission', async () => {
    const mockStrategy = createMockStrategy({
      send: vi.fn(async () => ({
        status: 'submitted' as const,
        hash: 'real-hash-abc',
      })),
    });

    const { result } = renderHook(() =>
      useSendTransaction({ sendStrategy: mockStrategy, network: 'testnet' })
    );

    await act(async () => {
      await result.current.sendTransaction({ recipient: VALID_ADDRESS, amount: 5 });
    });

    // After real submission, transaction should be pending (awaiting poll)
    await waitFor(() => {
      expect(result.current.optimisticTransaction?.status).toBe('pending');
    });

    expect(result.current.optimisticTransaction?.hash).toBe('real-hash-abc');
  });

  it('reports error from real strategy', async () => {
    const mockStrategy = createMockStrategy({
      send: vi.fn(async () => {
        throw new Error('Signing failed');
      }),
    });

    const { result } = renderHook(() =>
      useSendTransaction({ sendStrategy: mockStrategy, network: 'testnet' })
    );

    await act(async () => {
      await expect(
        result.current.sendTransaction({ recipient: VALID_ADDRESS, amount: 10 })
      ).rejects.toThrow('Signing failed');
    });

    expect(result.current.error?.message).toBe('Signing failed');
    expect(result.current.optimisticTransaction).toBeNull();
  });

  it('falls back to demo mode when sendStrategy is null and demoMode is true', async () => {
    const { result } = renderHook(() =>
      useSendTransaction({ sendStrategy: null, demoMode: true, ...fastOptions })
    );

    await act(async () => {
      await result.current.sendTransaction({ recipient: VALID_ADDRESS, amount: 100 });
    });

    expect(result.current.optimisticTransaction?.status).toBe('confirmed');
  });

  it('sets signMethod on optimistic transaction', async () => {
    const mockStrategy = createMockStrategy({ name: 'relayer' });
    const { result } = renderHook(() =>
      useSendTransaction({ sendStrategy: mockStrategy, network: 'testnet' })
    );

    await act(async () => {
      await result.current.sendTransaction({ recipient: VALID_ADDRESS, amount: 10 });
    });

    expect(result.current.optimisticTransaction?.signMethod).toBe('relayer');
  });
});
