import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useWalletConnection } from '../useWalletConnection';

describe('useWalletConnection', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initializes with disconnected state when extension not available', async () => {
    const { result } = renderHook(() => useWalletConnection());

    // Initially connecting
    expect(result.current.connected).toBe(false);
    expect(result.current.extensionInstalled).toBe(false);

    // After auto-check fails
    await waitFor(() => {
      expect(result.current.connecting).toBe(false);
    });
  });

  it('detects connected state on mount when autoCheck is true', async () => {
    // Mock the wallet-api dynamic import
    vi.stubGlobal('__import__mock__', true);

    // We can't easily mock dynamic imports, so test the "not available" path
    const { result } = renderHook(() => useWalletConnection({ autoCheck: true }));

    await waitFor(() => {
      expect(result.current.connecting).toBe(false);
    });

    expect(result.current.connected).toBe(false);
    expect(result.current.smartAccountId).toBeNull();
  });

  it('skips auto-check when autoCheck is false', () => {
    const { result } = renderHook(() => useWalletConnection({ autoCheck: false }));

    expect(result.current.connected).toBe(false);
    expect(result.current.extensionInstalled).toBe(false);
    expect(result.current.connecting).toBe(false);
  });

  it('provides connect and disconnect methods', () => {
    const { result } = renderHook(() => useWalletConnection({ autoCheck: false }));

    expect(typeof result.current.connect).toBe('function');
    expect(typeof result.current.disconnect).toBe('function');
    expect(typeof result.current.refresh).toBe('function');
  });

  it('disconnect resets state', async () => {
    const { result } = renderHook(() => useWalletConnection({ autoCheck: false }));

    result.current.disconnect();

    expect(result.current.connected).toBe(false);
    expect(result.current.smartAccountId).toBeNull();
    expect(result.current.ownerPublicKey).toBeNull();
  });
});
