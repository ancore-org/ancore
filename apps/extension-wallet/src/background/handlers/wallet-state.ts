import { registerHandler } from '@/messaging';
import { readAuthState } from '@/router/AuthGuard';
import { isBackgroundSessionUnlockedAsync } from '../session-state';
import { createLogger } from '../logger';

const log = createLogger('[ancore-extension/handlers/wallet-state]');

export function registerWalletStateHandlers(): void {
  registerHandler('GET_WALLET_STATE', async () => {
    const authState = readAuthState();

    if (!authState.hasOnboarded) {
      return { state: 'uninitialized' as const };
    }

    const unlocked = await isBackgroundSessionUnlockedAsync();
    if (!unlocked) {
      return { state: 'locked' as const };
    }

    return { state: 'unlocked' as const };
  });

  log.debug('registered');
}
