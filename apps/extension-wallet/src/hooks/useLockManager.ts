/**
 * useLockManager hook
 *
 * Provides lock/unlock state and actions to React components.
 * Integrates with the session store so the rest of the app reacts to lock changes.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { SecureStorageManager } from '@ancore/core-sdk';
import { createStorageAdapter } from '@ancore/core-sdk';
import { LockManager } from '../security/lock-manager';
import { getSettingsState } from '../stores/settings';
import { setSessionState } from '../stores/session';

// Singleton storage manager shared across hook instances
let _storageManager: SecureStorageManager | null = null;

function getStorageManager(): SecureStorageManager {
  if (!_storageManager) {
    _storageManager = new SecureStorageManager(createStorageAdapter());
  }
  return _storageManager;
}

export interface UseLockManagerResult {
  isLocked: boolean;
  unlock: (password: string) => Promise<void>;
  lock: () => void;
}

export function useLockManager(): UseLockManagerResult {
  const [isLocked, setIsLocked] = useState(true);
  const managerRef = useRef<LockManager | null>(null);

  useEffect(() => {
    const { autoLockMinutes } = getSettingsState();

    const manager = new LockManager({
      autoLockMinutes,
      storageManager: getStorageManager(),
      onLock: () => {
        setIsLocked(true);
        setSessionState((s) => ({ ...s, status: 'locked' }));
      },
      onUnlock: () => {
        setIsLocked(false);
        setSessionState((s) => ({ ...s, status: 'ready', lastActiveAt: Date.now() }));
      },
    });

    managerRef.current = manager;

    return () => {
      manager.destroy();
      managerRef.current = null;
    };
  }, []);

  const unlock = useCallback(async (password: string) => {
    if (!managerRef.current) throw new Error('LockManager not initialized');
    await managerRef.current.unlock(password);
  }, []);

  const lock = useCallback(() => {
    managerRef.current?.lock();
  }, []);

  return { isLocked, unlock, lock };
}
