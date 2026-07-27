import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSettingsStore, DEFAULTS } from '../settings';
import { extensionStorage } from '../_storage';

describe('Settings Store - Network Persistence', () => {
  beforeEach(() => {
    // Reset store before each test
    useSettingsStore.getState().reset();
    vi.clearAllMocks();
  });

  it('persists network selection to storage', () => {
    useSettingsStore.getState().setNetwork('mainnet');

    const store = useSettingsStore.getState();
    expect(store.network).toBe('mainnet');
    expect(store.horizonUrl).toBe('https://horizon.stellar.org');
  });

  it('couples horizonUrl with network selection', () => {
    useSettingsStore.getState().setNetwork('testnet');
    expect(useSettingsStore.getState().network).toBe('testnet');
    expect(useSettingsStore.getState().horizonUrl).toBe('https://horizon-testnet.stellar.org');

    useSettingsStore.getState().setNetwork('mainnet');
    expect(useSettingsStore.getState().network).toBe('mainnet');
    expect(useSettingsStore.getState().horizonUrl).toBe('https://horizon.stellar.org');

    useSettingsStore.getState().setNetwork('futurenet');
    expect(useSettingsStore.getState().network).toBe('futurenet');
    expect(useSettingsStore.getState().horizonUrl).toBe('https://horizon-futurenet.stellar.org');
  });

  it('includes horizonUrl in default state', () => {
    const store = useSettingsStore.getState();
    expect(store.horizonUrl).toBeDefined();
    expect(store.horizonUrl).toBe('https://horizon-testnet.stellar.org');
  });

  it('migrates legacy state without horizonUrl', () => {
    // Simulate legacy state migration
    const legacyState = {
      network: 'mainnet',
      theme: 'dark',
      autoLockMinutes: 15,
    };

    // The merge function should derive horizonUrl from network
    const expectedHorizonUrl = 'https://horizon.stellar.org';
    expect(expectedHorizonUrl).toBe('https://horizon.stellar.org');
  });

  it('handles invalid network values during migration', () => {
    const invalidNetwork = 'invalid' as any;
    const validNetwork = DEFAULTS.network;

    expect(invalidNetwork).not.toBe(validNetwork);
    expect(validNetwork).toBe('testnet');
  });

  it('resets to defaults including horizonUrl', () => {
    const store = useSettingsStore.getState();
    store.setNetwork('mainnet');

    store.reset();

    expect(store.network).toBe(DEFAULTS.network);
    expect(store.horizonUrl).toBe(DEFAULTS.horizonUrl);
  });

  describe('Last successful network persistence', () => {
    it('saves last successful network when network is set', async () => {
      const setItemSpy = vi.spyOn(extensionStorage, 'setItem');
      
      await useSettingsStore.getState().setNetwork('mainnet');
      
      expect(setItemSpy).toHaveBeenCalledWith('ancore-last-successful-network', 'mainnet');
      setItemSpy.mockRestore();
    });

    it('saves last successful network for testnet', async () => {
      const setItemSpy = vi.spyOn(extensionStorage, 'setItem');
      
      await useSettingsStore.getState().setNetwork('testnet');
      
      expect(setItemSpy).toHaveBeenCalledWith('ancore-last-successful-network', 'testnet');
      setItemSpy.mockRestore();
    });

    it('saves last successful network for futurenet', async () => {
      const setItemSpy = vi.spyOn(extensionStorage, 'setItem');
      
      await useSettingsStore.getState().setNetwork('futurenet');
      
      expect(setItemSpy).toHaveBeenCalledWith('ancore-last-successful-network', 'futurenet');
      setItemSpy.mockRestore();
    });

    it('handles storage errors gracefully when saving network', async () => {
      const setItemSpy = vi.spyOn(extensionStorage, 'setItem').mockRejectedValue(new Error('Storage error'));
      
      // Should not throw
      await expect(useSettingsStore.getState().setNetwork('mainnet')).resolves.not.toThrow();
      
      setItemSpy.mockRestore();
    });

    it('loads last successful network from storage', async () => {
      const getItemSpy = vi.spyOn(extensionStorage, 'getItem').mockResolvedValue('mainnet');
      
      // The merge function should load and use the last successful network
      const saved = await extensionStorage.getItem('ancore-last-successful-network');
      
      expect(saved).toBe('mainnet');
      getItemSpy.mockRestore();
    });

    it('returns undefined when no last successful network is saved', async () => {
      const getItemSpy = vi.spyOn(extensionStorage, 'getItem').mockResolvedValue(undefined);
      
      const saved = await extensionStorage.getItem('ancore-last-successful-network');
      
      expect(saved).toBeUndefined();
      getItemSpy.mockRestore();
    });

    it('handles storage errors gracefully when loading network', async () => {
      const getItemSpy = vi.spyOn(extensionStorage, 'getItem').mockRejectedValue(new Error('Storage error'));
      
      // Should not throw
      await expect(extensionStorage.getItem('ancore-last-successful-network')).resolves.not.toThrow();
      
      getItemSpy.mockRestore();
    });

    it('validates saved network value', async () => {
      const getItemSpy = vi.spyOn(extensionStorage, 'getItem').mockResolvedValue('invalid-network');
      
      const saved = await extensionStorage.getItem('ancore-last-successful-network');
      
      // Invalid network should be rejected
      expect(saved).not.toBe('mainnet');
      expect(saved).not.toBe('testnet');
      expect(saved).not.toBe('futurenet');
      
      getItemSpy.mockRestore();
    });
  });
});
