import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useAccountData } from '../useAccountData';

describe('useAccountData', () => {
  it('returns loading initially', () => {
    const { result } = renderHook(() => useAccountData('GABC'));
    expect(result.current.loading).toBe(true);
    expect(result.current.account).toBeNull();
  });

  it('resolves mock data for a valid address', async () => {
    const { result } = renderHook(() => useAccountData('GABC'));
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 2000 });
    expect(result.current.account).not.toBeNull();
    expect(result.current.account?.address).toBe('GABC');
    expect(result.current.transactions).toHaveLength(3);
    expect(result.current.error).toBeNull();
  });

  it('does not fetch when address is empty', () => {
    const { result } = renderHook(() => useAccountData(''));
    expect(result.current.loading).toBe(true);
    expect(result.current.account).toBeNull();
  });
});
