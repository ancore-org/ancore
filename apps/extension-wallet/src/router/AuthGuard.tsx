import * as React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { sendMessage } from '../messaging/sender';
import { recordCurrentDevice } from '../security/device-session-recorder';
import { useDeviceSessionsStore } from '../stores/deviceSessions';

export const AUTH_STORAGE_KEY = 'ancore_extension_auth';

export interface AuthState {
  hasOnboarded: boolean;
  walletName: string;
  accountAddress: string;
  smartAccountId?: string;
}

export const DEFAULT_AUTH_STATE: AuthState = {
  hasOnboarded: false,
  walletName: 'Ancore Wallet',
  accountAddress: 'GCFX...WALLET',
};

interface AuthContextValue {
  authState: AuthState;
  unlockError: string | null;
  isUnlocked: boolean;
  completeOnboarding: (walletName: string, publicKey?: string, smartAccountId?: string) => void;
  unlockWallet: (password: string) => Promise<boolean>;
  lockWallet: () => void;
  resetWallet: () => void;
  refreshUnlockStatus: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export type UnlockVerifier = (password: string) => boolean | Promise<boolean>;

const DEFAULT_UNLOCK_ERROR = 'Incorrect password. Please try again.';

export function readAuthState(): AuthState {
  if (typeof window === 'undefined') {
    return DEFAULT_AUTH_STATE;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_AUTH_STATE;
    }

    return {
      ...DEFAULT_AUTH_STATE,
      ...JSON.parse(raw),
    };
  } catch {
    return DEFAULT_AUTH_STATE;
  }
}

function writeAuthState(authState: AuthState): void {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authState));
}

function hasExtensionStorage(): boolean {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return true;
  }
  if (typeof browser !== 'undefined' && browser.storage?.local) {
    return true;
  }
  return false;
}

/** Playwright dev-server harness: unlock without extension storage APIs. */
function readE2eInitiallyUnlocked(): boolean {
  return typeof window !== 'undefined' && window.__E2E_INITIALLY_UNLOCKED__ === true;
}

export function ExtensionAuthProvider({
  children,
  unlockVerifier,
  initiallyUnlocked = false,
}: {
  children: React.ReactNode;
  unlockVerifier?: UnlockVerifier;
  /**
   * Test-only seam. `isUnlocked` is deliberately in-memory (never persisted),
   * so tests that need to start past the lock screen cannot arrange it via
   * storage the way they arrange `authState`.
   */
  initiallyUnlocked?: boolean;
}) {
  const [authState, setAuthState] = React.useState<AuthState>(readAuthState);
  const [unlockError, setUnlockError] = React.useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = React.useState(initiallyUnlocked);
  const [isInitializing, setIsInitializing] = React.useState(true);

  React.useEffect(() => {
    writeAuthState(authState);
  }, [authState]);

  React.useEffect(() => {
    async function initVault() {
      if (!hasExtensionStorage()) {
        if (readE2eInitiallyUnlocked()) {
          setIsUnlocked(true);
        }
        setIsInitializing(false);
        return;
      }

      try {
        const { getSharedStorageManager } = await import('../security/storage-manager');
        const storageManager = getSharedStorageManager();
        const vaultExists = await storageManager.hasVault();

        setAuthState((current) => {
          const hasOnboarded = vaultExists ? true : current.hasOnboarded;
          if (hasOnboarded === current.hasOnboarded) {
            return current;
          }
          const next = { ...current, hasOnboarded };
          writeAuthState(next);
          return next;
        });

        // Check initial unlock status from background
        await refreshUnlockStatusInternal();
      } catch (err) {
        console.error('Failed to check vault', err);
      } finally {
        setIsInitializing(false);
      }
    }

    void initVault();
  }, []);

  React.useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === AUTH_STORAGE_KEY) {
        setAuthState(readAuthState());
      }
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  /**
   * Refresh unlock status from background service worker.
   * This is the single source of truth for lock state.
   */
  async function refreshUnlockStatusInternal() {
    try {
      if (!hasExtensionStorage()) {
        return;
      }

      const response = await chrome.runtime.sendMessage({ type: 'GET_WALLET_STATE' });
      if (response?.state === 'unlocked') {
        setIsUnlocked(true);
      } else {
        setIsUnlocked(false);
      }
    } catch (err) {
      console.error('Failed to refresh unlock status', err);
      setIsUnlocked(false);
    }
  }

  const value = React.useMemo<AuthContextValue>(
    () => ({
      authState,
      unlockError,
      isUnlocked,
      completeOnboarding: (walletName: string, publicKey?: string, smartAccountId?: string) => {
        setUnlockError(null);
        setAuthState({
          hasOnboarded: true,
          walletName: walletName.trim() || DEFAULT_AUTH_STATE.walletName,
          accountAddress: publicKey ?? DEFAULT_AUTH_STATE.accountAddress,
          ...(smartAccountId ? { smartAccountId } : {}),
        });
        setIsUnlocked(true);
        void recordCurrentDevice();
      },
      unlockWallet: async (password: string) => {
        try {
          let isValid: boolean;

          if (unlockVerifier) {
            isValid = await unlockVerifier(password);
          } else if (hasExtensionStorage()) {
            const response = await sendMessage('UNLOCK_WALLET', { password });
            isValid = response.success;
          } else {
            isValid = Boolean(password.trim());
          }

          if (!isValid) {
            setUnlockError(DEFAULT_UNLOCK_ERROR);
            setIsUnlocked(false);
            return false;
          }

          setUnlockError(null);
          setIsUnlocked(true);
          // Fire-and-forget: device bookkeeping must never delay or fail an
          // otherwise successful unlock.
          void recordCurrentDevice();
          return true;
        } catch {
          setUnlockError(DEFAULT_UNLOCK_ERROR);
          setIsUnlocked(false);
          return false;
        }
      },
      lockWallet: () => {
        setUnlockError(null);
        setIsUnlocked(false);
        if (hasExtensionStorage()) {
          void sendMessage('LOCK_WALLET', {}).catch((error: unknown) => {
            console.error('Failed to lock wallet in background', error);
          });
        }
      },
      resetWallet: () => {
        setUnlockError(null);
        setAuthState(DEFAULT_AUTH_STATE);
        setIsUnlocked(false);
        // A reset discards the vault, so the trusted-device list that belonged
        // to it must not survive into the next wallet.
        useDeviceSessionsStore.getState().reset();
      },
      refreshUnlockStatus: refreshUnlockStatusInternal,
    }),
    [authState, unlockError, unlockVerifier, isUnlocked]
  );

  return (
    <AuthContext.Provider value={value}>
      {isInitializing ? (
        <div
          className="flex min-h-screen items-center justify-center bg-background"
          data-testid="auth-initializing"
        >
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useExtensionAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);

  if (!context) {
    throw new Error('useExtensionAuth must be used within ExtensionAuthProvider');
  }

  return context;
}

export function AuthGuard() {
  const { authState, isUnlocked } = useExtensionAuth();
  const location = useLocation();

  if (!authState.hasOnboarded) {
    return <Navigate replace state={{ from: location.pathname }} to="/onboarding" />;
  }

  if (!isUnlocked) {
    return <Navigate replace state={{ from: location.pathname }} to="/unlock" />;
  }

  return <Outlet />;
}

export function PublicOnlyGuard({
  children,
  mode,
}: {
  children: React.ReactElement;
  mode: 'welcome' | 'onboarding' | 'unlock';
}) {
  const { authState, isUnlocked } = useExtensionAuth();

  if (mode === 'unlock') {
    if (isUnlocked) {
      return <Navigate replace to="/home" />;
    }

    return children;
  }

  if (authState.hasOnboarded) {
    return <Navigate replace to={isUnlocked ? '/home' : '/unlock'} />;
  }

  return children;
}
