/**
 * useLockManager hook
 *
 * Provides lock/unlock state and actions to React components.
 * Integrates with the session store so the rest of the app reacts to lock changes.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { SecureStorageManager } from '@ancore/core-sdk';
import { LockManager } from '../security/lock-manager';
import { getSharedStorageManager } from '../security/storage-manager';
import { getSettingsState, useSettingsStore } from '../stores/settings';
import { setSessionState } from '../stores/session';
import { useHotkey } from './useHotkey';
import { useExtensionAuth } from '../router/AuthGuard';

// Singleton storage manager shared across hook instances
type StorageManagerInstance = InstanceType<typeof SecureStorageManager>;

function getStorageManager(): StorageManagerInstance {
  return getSharedStorageManager();
}

export interface UseLockManagerResult {
  isLocked: boolean;
  unlock: (password: string) => Promise<void>;
  lock: () => void;
}

export function useLockManager(): UseLockManagerResult {
  const [isLocked, setIsLocked] = useState(true);
  const managerRef = useRef<LockManager | null>(null);

  let authContext: ReturnType<typeof useExtensionAuth> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    authContext = useExtensionAuth();
  } catch {
    authContext = null;
  }

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
    const unsubscribe = useSettingsStore.subscribe((state, previousState) => {
      if (state.autoLockMinutes !== previousState.autoLockMinutes) {
        manager.setAutoLockMinutes(state.autoLockMinutes);
      }
    });

    return () => {
      unsubscribe();
      manager.destroy();
      managerRef.current = null;
    };
  }, []);

  const unlock = useCallback(
    async (password: string) => {
      if (authContext) {
        const ok = await authContext.unlockWallet(password);
        if (!ok) throw new Error('Incorrect password');
        return;
      }
      if (!managerRef.current) throw new Error('LockManager not initialized');
      await managerRef.current.unlock(password);
    },
    [authContext]
  );

  const lock = useCallback(() => {
    if (authContext) {
      authContext.lockWallet();
    } else {
      managerRef.current?.lock();
    }
  }, [authContext]);

  const enableLockShortcut = useSettingsStore((state) => state.enableLockShortcut);
  const activeIsLocked = authContext ? !authContext.isUnlocked : isLocked;

  // Register cross-platform keyboard shortcut: ⌘+Shift+L (Mac) / Ctrl+Shift+L (Win/Linux)
  useHotkey('Meta+Shift+L', lock, {
    enabled: enableLockShortcut && !activeIsLocked,
    ignoreInputs: true,
  });
  useHotkey('Ctrl+Shift+L', lock, {
    enabled: enableLockShortcut && !activeIsLocked,
    ignoreInputs: true,
  });

  return { isLocked: activeIsLocked, unlock, lock };
}
