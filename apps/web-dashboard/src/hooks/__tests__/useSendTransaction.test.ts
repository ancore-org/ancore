import { renderHook, act, waitFor } from '@testing-library/react';
import { useSendTransaction } from '../useSendTransaction';

describe('useSendTransaction', () => {
  it('initializes with no optimistic transaction', () => {
    const { result } = renderHook(() => useSendTransaction());
    expect(result.current.optimisticTransaction).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('creates optimistic transaction immediately on send', async () => {
    const { result } = renderHook(() => useSendTransaction());

    await act(async () => {
      result.current.sendTransaction({
        recipient: 'GRECIPIENT123',
        amount: 100,
      });
    });

    await waitFor(() => {
      expect(result.current.optimisticTransaction).not.toBeNull();
    });

    expect(result.current.optimisticTransaction?.type).toBe('send');
    expect(result.current.optimisticTransaction?.amount).toBe(100);
    expect(result.current.optimisticTransaction?.counterparty).toBe('GRECIPIENT123');
    expect(result.current.optimisticTransaction?.status).toBe('pending');
  });

  it('handles transaction submission', async () => {
    const { result } = renderHook(() => useSendTransaction());

    await act(async () => {
      const tx = await result.current.sendTransaction({
        recipient: 'GRECIPIENT123',
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
    const { result } = renderHook(() => useSendTransaction());

    await act(async () => {
      await result.current.sendTransaction({
        recipient: 'GRECIPIENT123',
        amount: 100,
      });
    });

    await waitFor(() => {
      expect(result.current.optimisticTransaction?.status).toBe('confirmed');
    });
  });

  it('clears optimistic transaction on demand', async () => {
    const { result } = renderHook(() => useSendTransaction());

    await act(async () => {
      await result.current.sendTransaction({
        recipient: 'GRECIPIENT123',
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
    const { result } = renderHook(() => useSendTransaction());

    await act(async () => {
      await result.current.sendTransaction({
        recipient: 'GRECIPIENT123',
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

  it('provides lifecycle management methods', () => {
    const { result } = renderHook(() => useSendTransaction());

    expect(typeof result.current.sendTransaction).toBe('function');
    expect(typeof result.current.clearOptimistic).toBe('function');
    expect(typeof result.current.rollback).toBe('function');
  });
});
