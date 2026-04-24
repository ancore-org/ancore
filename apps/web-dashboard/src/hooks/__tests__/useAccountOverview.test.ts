import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useAccountOverview } from '../useAccountOverview';

describe('useAccountOverview', () => {
  it('fetches account data successfully', async () => {
    const { result } = renderHook(() => useAccountOverview('GB...'));

    expect(result.current.isLoading).toBe(true);
    
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });

    expect(result.current.data).toEqual({
      balance: 1250.75,
      nonce: 42,
      status: 'active',
    });
    expect(result.current.error).toBeNull();
  });

  it('handles empty public key', () => {
    const { result } = renderHook(() => useAccountOverview(''));
    // Depending on implementation, it might stay loading or set error
    // In my current implementation it just returns initial state
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
  });
});
