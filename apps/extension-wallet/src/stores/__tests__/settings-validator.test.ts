import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULTS, useSettingsStore } from '../settings';

beforeEach(() => {
  localStorage.clear();
  useSettingsStore.setState(DEFAULTS);
});

describe('setAutoLockMinutes — bounds validation', () => {
  it('accepts the minimum valid value of 1 minute', () => {
    useSettingsStore.getState().setAutoLockMinutes(1);
    expect(useSettingsStore.getState().autoLockMinutes).toBe(1);
  });

  it('accepts the maximum valid value of 1440 minutes (24h)', () => {
    useSettingsStore.getState().setAutoLockMinutes(1440);
    expect(useSettingsStore.getState().autoLockMinutes).toBe(1440);
  });

  it('accepts a normal mid-range value', () => {
    useSettingsStore.getState().setAutoLockMinutes(30);
    expect(useSettingsStore.getState().autoLockMinutes).toBe(30);
  });

  it('rejects zero', () => {
    expect(() => useSettingsStore.getState().setAutoLockMinutes(0)).toThrow(RangeError);
    expect(useSettingsStore.getState().autoLockMinutes).toBe(DEFAULTS.autoLockMinutes);
  });

  it('rejects negative values', () => {
    expect(() => useSettingsStore.getState().setAutoLockMinutes(-1)).toThrow(RangeError);
    expect(useSettingsStore.getState().autoLockMinutes).toBe(DEFAULTS.autoLockMinutes);
  });

  it('rejects values over 1440', () => {
    expect(() => useSettingsStore.getState().setAutoLockMinutes(1441)).toThrow(RangeError);
    expect(useSettingsStore.getState().autoLockMinutes).toBe(DEFAULTS.autoLockMinutes);
  });

  it('rejects NaN', () => {
    expect(() => useSettingsStore.getState().setAutoLockMinutes(NaN)).toThrow(RangeError);
  });

  it('rejects Infinity', () => {
    expect(() => useSettingsStore.getState().setAutoLockMinutes(Infinity)).toThrow(RangeError);
  });

  it('rejects a numeric string', () => {
    expect(() =>
      useSettingsStore.getState().setAutoLockMinutes('15' as unknown as number)
    ).toThrow(RangeError);
  });

  it('does not mutate state when validation fails', () => {
    useSettingsStore.getState().setAutoLockMinutes(60);
    expect(() => useSettingsStore.getState().setAutoLockMinutes(-5)).toThrow();
    expect(useSettingsStore.getState().autoLockMinutes).toBe(60);
  });
});
