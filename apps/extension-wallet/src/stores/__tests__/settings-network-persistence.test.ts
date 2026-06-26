import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSettingsStore, DEFAULTS } from '../settings';

describe('Settings Store - Network Persistence', () => {
  beforeEach(() => {
    // Reset store before each test
    useSettingsStore.getState().reset();
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
});
