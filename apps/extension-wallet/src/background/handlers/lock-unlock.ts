import { registerHandler } from '@/messaging';
import { readAuthState } from '@/router/AuthGuard';
import { getSharedStorageManager } from '@/security/storage-manager';
import {
  checkUnlockRateLimit,
  clearUnlockAttemptState,
  loadUnlockAttemptState,
  recordUnlockFailure,
  saveUnlockAttemptState,
} from '@/background/unlock-rate-limit';
import { setChromeLocalStorage } from '../chrome-storage';
import {
  clearUnlockSession,
  persistUnlockSession,
  setBackgroundSessionUnlocked,
} from '../session-state';

const logPrefix = '[ancore-extension/handlers/lock-unlock]';

export function registerLockUnlockHandlers(): void {
  registerHandler('LOCK_WALLET', async () => {
    try {
      setBackgroundSessionUnlocked(false);
      getSharedStorageManager().lock();
      await clearUnlockSession();

      const authState = readAuthState();
      await setChromeLocalStorage(
        'ancore_extension_auth',
        JSON.stringify({
          ...authState,
          isUnlocked: false,
        })
      );

      console.info(`${logPrefix} wallet locked`);
      return { success: true };
    } catch (err) {
      console.error(`${logPrefix} lock failed`, err);
      return { success: false };
    }
  });

  registerHandler('UNLOCK_WALLET', async ({ password }) => {
    try {
      if (!password || typeof password !== 'string') {
        console.warn(`${logPrefix} unlock attempted with invalid password`);
        return { success: false };
      }

      const attemptState = await loadUnlockAttemptState();
      const rateLimit = checkUnlockRateLimit(attemptState);
      if (rateLimit.locked) {
        console.warn(`${logPrefix} unlock throttled`, { retryAfterMs: rateLimit.retryAfterMs });
        return {
          success: false,
          retryAfterMs: rateLimit.retryAfterMs,
          message: rateLimit.message,
        };
      }

      const authState = readAuthState();
      if (!authState.hasOnboarded) {
        console.warn(`${logPrefix} unlock attempted before onboarding`);
        return { success: false };
      }

      const storageManager = getSharedStorageManager();
      const isUnlocked = await storageManager.unlock(password);

      if (!isUnlocked) {
        console.warn(`${logPrefix} unlock rejected by SecureStorageManager`);
        const nextState = recordUnlockFailure(attemptState);
        await saveUnlockAttemptState(nextState);
        const lockout = checkUnlockRateLimit(nextState);
        if (lockout.locked) {
          return {
            success: false,
            retryAfterMs: lockout.retryAfterMs,
            message: lockout.message,
          };
        }
        return { success: false };
      }

      await clearUnlockAttemptState();
      await persistUnlockSession();

      await setChromeLocalStorage(
        'ancore_extension_auth',
        JSON.stringify({
          ...authState,
          isUnlocked: true,
        })
      );

      console.info(`${logPrefix} wallet unlocked`);
      return { success: true };
    } catch (err) {
      console.error(`${logPrefix} unlock failed`, err);
      setBackgroundSessionUnlocked(false);
      return { success: false };
    }
  });

  if (import.meta.env.DEV) {
    console.debug(`${logPrefix} registered`);
  }
}
