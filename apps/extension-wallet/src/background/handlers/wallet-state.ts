import { registerHandler } from '@/messaging';
import { readAuthState } from '@/router/AuthGuard';
import { isBackgroundSessionUnlocked } from '../session-state';

const logPrefix = '[ancore-extension/handlers/wallet-state]';

export function registerWalletStateHandlers(): void {
  registerHandler('GET_WALLET_STATE', async () => {
    const authState = readAuthState();

    if (!authState.hasOnboarded) {
      return { state: 'uninitialized' as const };
    }

    if (!isBackgroundSessionUnlocked()) {
      return { state: 'locked' as const };
    }

    return { state: 'unlocked' as const };
  });

  if (import.meta.env.DEV) {
    console.debug(`${logPrefix} registered`);
  }
}
