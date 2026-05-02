import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULTS, useSettingsStore } from '../settings';

beforeEach(() => {
  localStorage.clear();
  useSettingsStore.setState(DEFAULTS);
});

describe('useSettingsStore', () => {
  it('has correct defaults', () => {
    const { network, theme, autoLockMinutes, requirePasswordForSensitiveActions } =
      useSettingsStore.getState();
    expect(network).toBe('testnet');
    expect(theme).toBe('dark');
    expect(autoLockMinutes).toBe(15);
    expect(requirePasswordForSensitiveActions).toBe(true);
  });

  it('updates network', () => {
    useSettingsStore.getState().setNetwork('mainnet');
    expect(useSettingsStore.getState().network).toBe('mainnet');
  });

  it('updates theme', () => {
    useSettingsStore.getState().setTheme('light');
    expect(useSettingsStore.getState().theme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('updates autoLockMinutes', () => {
    useSettingsStore.getState().setAutoLockMinutes(60);
    expect(useSettingsStore.getState().autoLockMinutes).toBe(60);
  });

  it('updates security toggle', () => {
    useSettingsStore.getState().setRequirePasswordForSensitiveActions(false);
    expect(useSettingsStore.getState().requirePasswordForSensitiveActions).toBe(false);
  });

  it('resets to defaults', () => {
    useSettingsStore.getState().setNetwork('mainnet');
    useSettingsStore.getState().setAutoLockMinutes(60);
    useSettingsStore.getState().reset();

    const { network, autoLockMinutes } = useSettingsStore.getState();
    expect(network).toBe('testnet');
    expect(autoLockMinutes).toBe(15);
  });

  it('merges missing keys during rehydrate', async () => {
    localStorage.setItem(
      'ancore-settings',
      JSON.stringify({
        state: { network: 'mainnet' },
        version: 0,
      })
    );

    await useSettingsStore.persist.rehydrate();

    const state = useSettingsStore.getState();
    expect(state.network).toBe('mainnet');
    expect(state.theme).toBe(DEFAULTS.theme);
    expect(state.autoLockMinutes).toBe(DEFAULTS.autoLockMinutes);
    expect(state.requirePasswordForSensitiveActions).toBe(
      DEFAULTS.requirePasswordForSensitiveActions
    );
  });
});
