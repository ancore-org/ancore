import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from '../settings';

beforeEach(() => {
  useSettingsStore.setState({ network: 'testnet', theme: 'dark', autoLockMinutes: 15 });
});

describe('useSettingsStore', () => {
  it('has correct defaults', () => {
    const { network, theme, autoLockMinutes } = useSettingsStore.getState();
    expect(network).toBe('testnet');
    expect(theme).toBe('dark');
    expect(autoLockMinutes).toBe(15);
  });

  it('updates network', () => {
    useSettingsStore.getState().setNetwork('mainnet');
    expect(useSettingsStore.getState().network).toBe('mainnet');
  });

  it('updates theme', () => {
    useSettingsStore.getState().setTheme('light');
    expect(useSettingsStore.getState().theme).toBe('light');
  });

  it('updates autoLockMinutes', () => {
    useSettingsStore.getState().setAutoLockMinutes(60);
    expect(useSettingsStore.getState().autoLockMinutes).toBe(60);
  });

  it('resets to defaults', () => {
    useSettingsStore.getState().setNetwork('mainnet');
    useSettingsStore.getState().setAutoLockMinutes(60);
    useSettingsStore.getState().reset();

    const { network, autoLockMinutes } = useSettingsStore.getState();
    expect(network).toBe('testnet');
    expect(autoLockMinutes).toBe(15);
  });
});
