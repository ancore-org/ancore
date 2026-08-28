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
import { createLogger } from '../logger';

const log = createLogger('[ancore-extension/handlers/lock-unlock]');

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

      log.info('wallet locked');
      return { success: true };
    } catch (err) {
      log.error('lock failed', err);
      return { success: false };
    }
  });

  registerHandler('UNLOCK_WALLET', async ({ password }) => {
    try {
      if (!password || typeof password !== 'string') {
        log.warn('unlock attempted with invalid password');
        return { success: false };
      }

      const attemptState = await loadUnlockAttemptState();
      const rateLimit = checkUnlockRateLimit(attemptState);
      if (rateLimit.locked) {
        log.warn('unlock throttled', { retryAfterMs: rateLimit.retryAfterMs });
        return {
          success: false,
          retryAfterMs: rateLimit.retryAfterMs,
          message: rateLimit.message,
        };
      }

      const authState = readAuthState();
      if (!authState.hasOnboarded) {
        log.warn('unlock attempted before onboarding');
        return { success: false };
      }

      const storageManager = getSharedStorageManager();
      const isUnlocked = await storageManager.unlock(password);

      if (!isUnlocked) {
        log.warn('unlock rejected by SecureStorageManager');
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

      log.info('wallet unlocked');
      return { success: true };
    } catch (err) {
      log.error('unlock failed', err);
      setBackgroundSessionUnlocked(false);
      return { success: false };
    }
  });

  log.debug('registered');
}
