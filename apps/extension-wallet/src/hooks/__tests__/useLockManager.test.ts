import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLockManager } from '../useLockManager';
import { useSettingsStore, DEFAULTS } from '../../stores/settings';

const setAutoLockMinutesSpy = vi.fn();
const destroySpy = vi.fn();
const lockSpy = vi.fn();

vi.mock('@ancore/core-sdk', () => ({
  ChromeStorageAdapter: class {},
  SecureStorageManager: class {
    async unlock() {}
    lock() {}
  },
  createStorageAdapter: () => ({}),
}));

vi.mock('../../security/lock-manager', () => ({
  LockManager: class {
    async unlock() {}
    lock() {
      lockSpy();
    }
    setAutoLockMinutes(minutes: number) {
      setAutoLockMinutesSpy(minutes);
    }
    destroy() {
      destroySpy();
    }
  },
}));

describe('useLockManager', () => {
  beforeEach(() => {
    setAutoLockMinutesSpy.mockClear();
    destroySpy.mockClear();
    lockSpy.mockClear();
    useSettingsStore.setState(DEFAULTS);
  });

  it('propagates auto-lock settings changes without restart', () => {
    const { unmount } = renderHook(() => useLockManager());

    act(() => {
      useSettingsStore.getState().setAutoLockMinutes(1);
    });

    expect(setAutoLockMinutesSpy).toHaveBeenCalledWith(1);

    unmount();
    expect(destroySpy).toHaveBeenCalled();
  });

  it('lock() calls the underlying LockManager lock method', () => {
    const { result } = renderHook(() => useLockManager());

    act(() => {
      result.current.lock();
    });

    expect(lockSpy).toHaveBeenCalledTimes(1);
  });
});
