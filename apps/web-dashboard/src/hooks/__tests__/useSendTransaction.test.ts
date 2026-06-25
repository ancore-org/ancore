import { renderHook, act, waitFor } from '@testing-library/react';
import { useSendTransaction } from '../useSendTransaction';

const VALID_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const fastOptions = { submitDelayMs: 0, confirmationDelayMs: 0 };

describe('useSendTransaction', () => {
  it('initializes with no optimistic transaction', () => {
    const { result } = renderHook(() => useSendTransaction(fastOptions));
    expect(result.current.optimisticTransaction).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('creates optimistic transaction immediately on send', async () => {
    const { result } = renderHook(() => useSendTransaction(fastOptions));

    await act(async () => {
      result.current.sendTransaction({
        recipient: VALID_ADDRESS,
        amount: 100,
      });
    });

    await waitFor(() => {
      expect(result.current.optimisticTransaction).not.toBeNull();
    });

    expect(result.current.optimisticTransaction?.type).toBe('send');
    expect(result.current.optimisticTransaction?.amount).toBe(100);
    expect(result.current.optimisticTransaction?.counterparty).toBe(VALID_ADDRESS);
    expect(result.current.optimisticTransaction?.status).toBe('pending');
  });

  it('handles transaction submission', async () => {
    const { result } = renderHook(() => useSendTransaction(fastOptions));

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

  it('updates transaction to confirmed after submission', async () => {
    const { result } = renderHook(() => useSendTransaction(fastOptions));

    await act(async () => {
      await result.current.sendTransaction({
        recipient: VALID_ADDRESS,
        amount: 100,
      });
    });

    await waitFor(() => {
      expect(result.current.optimisticTransaction?.status).toBe('confirmed');
    });
  });

  it('clears optimistic transaction on demand', async () => {
    const { result } = renderHook(() => useSendTransaction(fastOptions));

    await act(async () => {
      await result.current.sendTransaction({
        recipient: VALID_ADDRESS,
        amount: 100,
      });
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
    const { result } = renderHook(() => useSendTransaction(fastOptions));

    await act(async () => {
      await result.current.sendTransaction({
        recipient: VALID_ADDRESS,
        amount: 100,
      });
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
    const { result } = renderHook(() => useSendTransaction({ ...fastOptions, resolveHandle }));

    await act(async () => {
      await result.current.sendTransaction({
        recipient: '@Alice',
        amount: 25,
      });
    });

    expect(resolveHandle).toHaveBeenCalledWith('@alice');
    expect(result.current.resolvedRecipient?.accountAddress).toBe(VALID_ADDRESS);
    expect(result.current.optimisticTransaction?.counterparty).toBe(VALID_ADDRESS);
  });

  it('surfaces a clear error when a handle is not found', async () => {
    const { result } = renderHook(() =>
      useSendTransaction({ ...fastOptions, resolveHandle: vi.fn(async () => null) })
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
    const { result } = renderHook(() => useSendTransaction(fastOptions));

    expect(typeof result.current.sendTransaction).toBe('function');
    expect(typeof result.current.clearOptimistic).toBe('function');
    expect(typeof result.current.rollback).toBe('function');
  });
});
