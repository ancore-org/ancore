import { registerHandler, installMessageDispatcher } from '@/messaging';
import { getSharedStorageManager } from '@/security/storage-manager';
import { readAuthState } from '@/router/AuthGuard';
import {
  checkUnlockRateLimit,
  clearUnlockAttemptState,
  loadUnlockAttemptState,
  recordUnlockFailure,
  saveUnlockAttemptState,
} from '@/background/unlock-rate-limit';
import {
  probeAllServiceHealth,
  setCachedHealth,
  resolveRelayerUrl,
  resolveIndexerUrl,
  validateServiceUrls,
  type ServiceUrlConfig,
} from '@/config/urls';

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
    session: {
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
  runServiceHealthProbes().catch((err) => {
    console.warn(`${logPrefix} health probe failed on startup`, err);
  });
});

// ---------------------------------------------------------------------------
// Service URL health probing
// ---------------------------------------------------------------------------

/**
 * Resolves the active service URLs from storage (or falls back to defaults),
 * validates their format, then probes /health on each service.
 * Results are cached in the config/urls module so the popup can read them.
 */
async function runServiceHealthProbes(): Promise<void> {
  // Read persisted environment preference (defaults to 'production')
  let environment = 'production';
  try {
    const raw = await getChromeStorage('ancore_dashboard_settings');
    if (raw && typeof raw === 'string') {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (typeof parsed['environment'] === 'string') {
        environment = parsed['environment'];
      }
    }
  } catch {
    // Ignore storage errors — fall back to production
  }

  const config: ServiceUrlConfig = {
    relayerUrl: resolveRelayerUrl(environment),
    indexerUrl: resolveIndexerUrl(environment),
  };

  // Synchronous format check first
  const formatErrors = validateServiceUrls(config);
  if (formatErrors.length > 0) {
    console.warn(`${logPrefix} invalid service URLs`, formatErrors);
    return;
  }

  console.info(`${logPrefix} probing service health`, { environment });
  const results = await probeAllServiceHealth(config);

  for (const result of results) {
    setCachedHealth(result);
    if (result.status !== 'ok') {
      console.warn(`${logPrefix} service health degraded`, result);
    } else {
      console.info(`${logPrefix} service health ok`, {
        service: result.service,
        latencyMs: result.latencyMs,
      });
    }
  }
}

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
    getSharedStorageManager().lock();

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

    // Read persisted auth state
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

/**
 * CHECK_SERVICE_HEALTH — triggers a fresh health probe and returns results.
 *
 * Called by the popup when the user opens Settings or when a send is blocked.
 */
registerHandler('CHECK_SERVICE_HEALTH', async () => {
  try {
    await runServiceHealthProbes();
    const { getCachedHealth } = await import('@/config/urls');
    return {
      relayer: getCachedHealth('relayer'),
      indexer: getCachedHealth('indexer'),
    };
  } catch (err) {
    console.error(`${logPrefix} CHECK_SERVICE_HEALTH failed`, err);
    return {
      relayer: { service: 'relayer' as const, status: 'unreachable' as const },
      indexer: { service: 'indexer' as const, status: 'unreachable' as const },
    };
  }
});

// Activate the dispatcher — must be called after all handlers are registered.
installMessageDispatcher();
