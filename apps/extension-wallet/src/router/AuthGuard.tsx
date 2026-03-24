import * as React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

export const AUTH_STORAGE_KEY = 'ancore_extension_auth';

export interface AuthState {
  hasOnboarded: boolean;
  isUnlocked: boolean;
  walletName: string;
  accountAddress: string;
}

export const DEFAULT_AUTH_STATE: AuthState = {
  hasOnboarded: false,
  isUnlocked: false,
  walletName: 'Ancore Wallet',
  accountAddress: 'GCFX...WALLET',
};

interface AuthContextValue {
  authState: AuthState;
  completeOnboarding: (walletName: string) => void;
  unlockWallet: () => void;
  lockWallet: () => void;
  resetWallet: () => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

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

export function ExtensionAuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = React.useState<AuthState>(readAuthState);

  React.useEffect(() => {
    writeAuthState(authState);
  }, [authState]);

  React.useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === AUTH_STORAGE_KEY) {
        setAuthState(readAuthState());
      }
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      authState,
      completeOnboarding: (walletName: string) => {
        setAuthState({
          hasOnboarded: true,
          isUnlocked: true,
          walletName: walletName.trim() || DEFAULT_AUTH_STATE.walletName,
          accountAddress: DEFAULT_AUTH_STATE.accountAddress,
        });
      },
      unlockWallet: () => {
        setAuthState((current) => ({
          ...current,
          hasOnboarded: true,
          isUnlocked: true,
        }));
      },
      lockWallet: () => {
        setAuthState((current) => ({
          ...current,
          isUnlocked: false,
        }));
      },
      resetWallet: () => {
        setAuthState(DEFAULT_AUTH_STATE);
      },
    }),
    [authState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useExtensionAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);

  if (!context) {
    throw new Error('useExtensionAuth must be used within ExtensionAuthProvider');
  }

  return context;
}

export function AuthGuard() {
  const { authState } = useExtensionAuth();
  const location = useLocation();

  if (!authState.hasOnboarded) {
    return <Navigate replace state={{ from: location.pathname }} to="/welcome" />;
  }

  if (!authState.isUnlocked) {
    return <Navigate replace state={{ from: location.pathname }} to="/unlock" />;
  }

  return <Outlet />;
}

export function PublicOnlyGuard({
  children,
  mode,
}: {
  children: React.ReactElement;
  mode: 'welcome' | 'create-account' | 'unlock';
}) {
  const { authState } = useExtensionAuth();

  if (mode === 'unlock') {
    if (authState.isUnlocked) {
      return <Navigate replace to="/home" />;
    }

    return children;
  }

  if (authState.hasOnboarded) {
    return <Navigate replace to={authState.isUnlocked ? '/home' : '/unlock'} />;
  }

  return children;
}
