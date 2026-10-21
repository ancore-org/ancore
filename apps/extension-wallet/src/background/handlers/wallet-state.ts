import { registerHandler } from '@/messaging';
import { readAuthState } from '@/router/AuthGuard';
import { clearUnlockSession, isBackgroundSessionUnlocked } from '../session-state';
import { getSharedStorageManager } from '@/security/storage-manager';
import { createLogger } from '../logger';

const log = createLogger('[ancore-extension/handlers/wallet-state]');

export function registerWalletStateHandlers(): void {
  registerHandler('GET_WALLET_STATE', async () => {
    const authState = readAuthState();

    if (!authState.hasOnboarded) {
      return { state: 'uninitialized' as const };
    }

    const storageManager = getSharedStorageManager();
    if (!isBackgroundSessionUnlocked() || !storageManager.isUnlocked) {
      if (isBackgroundSessionUnlocked() && !storageManager.isUnlocked) {
        void clearUnlockSession();
      }
      return { state: 'locked' as const };
    }

    return { state: 'unlocked' as const };
  });

  log.debug('registered');
}
