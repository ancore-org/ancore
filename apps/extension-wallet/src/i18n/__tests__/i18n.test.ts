import { describe, it, expect } from 'vitest';
import i18n from '../index';
import {
  getAutoLockLabel,
  getDisplayLabel,
  getEnvironmentLabel,
  getNetworkLabel,
  getThemeLabel,
} from '../settings-labels';

describe('i18n initialization', () => {
  it('loads the English namespace', () => {
    expect(i18n.language).toBe('en');
    expect(i18n.t('settings.title')).toBe('Settings');
  });

  it('resolves nested settings keys used by SettingsScreen', () => {
    expect(i18n.t('settings.groups.security')).toBe('Security');
    expect(i18n.t('settings.toastDemo.success.message')).toBe('Payment sent successfully!');
  });
});

describe('settings label helpers', () => {
  const t = i18n.t.bind(i18n);

  it('maps network enums to locale keys', () => {
    expect(getNetworkLabel('testnet', t)).toBe('Testnet');
    expect(getNetworkLabel('mainnet', t)).toBe('Mainnet');
    expect(getNetworkLabel('local', t)).toBe('Local');
  });

  it('maps environment enums to locale keys', () => {
    expect(getEnvironmentLabel('production', t)).toBe('Production');
    expect(getEnvironmentLabel('staging', t)).toBe('Staging');
  });

  it('maps display and theme enums to locale keys', () => {
    expect(getDisplayLabel('comfortable', t)).toBe('Comfortable');
    expect(getDisplayLabel('compact', t)).toBe('Compact');
    expect(getThemeLabel('dark', t)).toBe('Dark');
    expect(getThemeLabel('light', t)).toBe('Light');
    expect(getThemeLabel('system', t)).toBe('System');
  });

  it('formats auto-lock labels including zero-minute edge case', () => {
    expect(getAutoLockLabel(0, t)).toBe('Never');
    expect(getAutoLockLabel(5, t)).toBe('5 min');
    expect(getAutoLockLabel(15, t)).toBe('15 min');
  });
});
