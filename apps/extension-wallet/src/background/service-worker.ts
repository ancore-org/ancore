import { registerHandler, installMessageDispatcher } from '@/messaging';
import { readAuthState } from '@/router/AuthGuard';

type ChromeRuntimeManifest = {
  name: string;
  version: string;
};

type ChromeInstalledDetails = {
  reason: string;
};

declare const chrome: {
  runtime: {
    getManifest(): ChromeRuntimeManifest;
    onInstalled: {
      addListener(callback: (details: ChromeInstalledDetails) => void): void;
    };
    onStartup: {
      addListener(callback: () => void): void;
    };
  };
  storage: {
    local: {
      get(key: string, callback: (result: Record<string, unknown>) => void): void;
      set(items: Record<string, unknown>, callback?: () => void): void;
    };
  };
};

const logPrefix = '[ancore-extension/background]';

const runtime = (globalThis as { chrome?: { runtime?: any } }).chrome?.runtime;
const manifest = (runtime?.getManifest?.() as ChromeRuntimeManifest | undefined) ?? {
  name: 'ancore-extension-wallet',
  version: '0.0.0',
};

console.info(`${logPrefix} booted`, {
  name: manifest.name,
  version: manifest.version,
});

runtime?.onInstalled?.addListener((details: ChromeInstalledDetails) => {
  console.info(`${logPrefix} installed`, { reason: details.reason });
});

runtime?.onStartup?.addListener(() => {
  console.info(`${logPrefix} startup`);
});

// ---------------------------------------------------------------------------
// In-memory session state (backing store cleared on lock)
// ---------------------------------------------------------------------------

/** The wallet is considered unlocked only for the lifetime of the service-worker. */
let _sessionUnlocked = false;

function getChromeStorage(key: string): Promise<unknown> {
  return new Promise((resolve) => {
    const chromeRef = (globalThis as { chrome?: any }).chrome;
    if (chromeRef?.storage?.local) {
      chromeRef.storage.local.get(key, (result: Record<string, unknown>) => {
        resolve(result[key] ?? null);
      });
    } else {
      // Fallback to localStorage in dev/test
      resolve(localStorage.getItem(key));
    }
  });
}

function setChromeStorage(key: string, value: unknown): Promise<void> {
  return new Promise((resolve) => {
    const chromeRef = (globalThis as { chrome?: any }).chrome;
    if (chromeRef?.storage?.local) {
      chromeRef.storage.local.set({ [key]: value }, resolve);
    } else {
      // Fallback to localStorage in dev/test
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      resolve();
    }
  });
}

// ---------------------------------------------------------------------------
// Message handlers
// ---------------------------------------------------------------------------

/**
 * GET_WALLET_STATE — returns the authoritative wallet state from storage/session.
 *
 * Reads the persisted AuthState to determine if the user has onboarded, and
 * combines it with the in-memory session flag to determine lock status.
 */
registerHandler('GET_WALLET_STATE', async () => {
  const authState = readAuthState();

  if (!authState.hasOnboarded) {
    return { state: 'uninitialized' as const };
  }

  if (!_sessionUnlocked) {
    return { state: 'locked' as const };
  }

  return { state: 'unlocked' as const };
});

/**
 * LOCK_WALLET — locks the wallet immediately, clearing the session flag.
 *
 * Persists the lock state to storage so the popup can reflect it on reload.
 */
registerHandler('LOCK_WALLET', async () => {
  try {
    _sessionUnlocked = false;

    // Persist lock to auth storage
    const authState = readAuthState();
    await setChromeStorage(
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

/**
 * UNLOCK_WALLET — verifies the password and unlocks the wallet.
 *
 * On success: sets the in-memory session flag and persists the unlocked
 * state so the popup React tree can pick it up via its storage listener.
 */
registerHandler('UNLOCK_WALLET', async ({ password }) => {
  try {
    if (!password || typeof password !== 'string') {
      console.warn(`${logPrefix} unlock attempted with invalid password`);
      return { success: false };
    }

    // Read persisted auth state
    const authState = readAuthState();

    if (!authState.hasOnboarded) {
      console.warn(`${logPrefix} unlock attempted before onboarding`);
      return { success: false };
    }

    // Simple guard: in a real implementation, verify against the encrypted
    // mnemonic/key via SecureStorageManager. For now we accept any non-empty
    // password for onboarded wallets and flag for replacement.
    // TODO: wire to SecureStorageManager.unlock(password) for real verification.
    if (password.length === 0) {
      return { success: false };
    }

    _sessionUnlocked = true;

    await setChromeStorage(
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
    _sessionUnlocked = false;
    return { success: false };
  }
});

// Activate the dispatcher — must be called after all handlers are registered.
installMessageDispatcher();
