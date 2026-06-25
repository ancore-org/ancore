import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export const DASHBOARD_SESSION_STORAGE_KEY = 'ancore_dashboard_session';

export interface DashboardSession {
  userId: string;
  displayName: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
}

export type AuthStatus = 'bootstrapping' | 'authenticated' | 'unauthenticated' | 'refreshing';

interface DashboardAuthContextValue {
  session: DashboardSession | null;
  status: AuthStatus;
  isBootstrapped: boolean;
  login: (displayName: string) => void;
  logout: () => void;
  refreshSession: () => void;
}

const DashboardAuthContext = createContext<DashboardAuthContextValue | null>(null);

const DEFAULT_DISPLAY_NAME = 'Dashboard User';
const SESSION_DURATION_MS = 15 * 60 * 1000;

function isDashboardSession(value: unknown): value is DashboardSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const session = value as Record<string, unknown>;
  return (
    typeof session.userId === 'string' &&
    typeof session.displayName === 'string' &&
    typeof session.accessToken === 'string' &&
    typeof session.refreshToken === 'string' &&
    Number.isFinite(session.accessTokenExpiresAt)
  );
}

export function readDashboardSession(): DashboardSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(DASHBOARD_SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isDashboardSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeDashboardSession(session: DashboardSession | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (session === null) {
    window.localStorage.removeItem(DASHBOARD_SESSION_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(DASHBOARD_SESSION_STORAGE_KEY, JSON.stringify(session));
}

function isExpired(session: DashboardSession): boolean {
  return session.accessTokenExpiresAt <= Date.now();
}

function createSession(displayName: string): DashboardSession {
  const normalizedDisplayName = displayName.trim() || DEFAULT_DISPLAY_NAME;

  return {
    userId: 'demo-user',
    displayName: normalizedDisplayName,
    accessToken: 'demo-access-token',
    refreshToken: 'demo-refresh-token',
    accessTokenExpiresAt: Date.now() + SESSION_DURATION_MS,
  };
}

export function DashboardAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DashboardSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>('bootstrapping');
  const [isBootstrapped, setIsBootstrapped] = useState(false);
  const [refreshQueued, setRefreshQueued] = useState(false);

  useEffect(() => {
    const restoredSession = readDashboardSession();
    setSession(restoredSession);
    if (restoredSession) {
      setStatus(isExpired(restoredSession) ? 'refreshing' : 'authenticated');
      setRefreshQueued(isExpired(restoredSession));
    } else {
      setStatus('unauthenticated');
    }
    setIsBootstrapped(true);
  }, []);

  useEffect(() => {
    if (!isBootstrapped || !refreshQueued || !session) {
      return;
    }

    let cancelled = false;

    const refresh = async () => {
      if (!session.refreshToken) {
        setSession(null);
        writeDashboardSession(null);
        setRefreshQueued(false);
        setStatus('unauthenticated');
        return;
      }

      await Promise.resolve();

      if (cancelled) {
        return;
      }

      const nextSession: DashboardSession = {
        ...session,
        accessToken: `${session.accessToken}.refreshed`,
        accessTokenExpiresAt: Date.now() + SESSION_DURATION_MS,
      };

      setSession(nextSession);
      writeDashboardSession(nextSession);
      setRefreshQueued(false);
      setStatus('authenticated');
    };

    void refresh().catch(() => {
      if (cancelled) {
        return;
      }

      setSession(null);
      writeDashboardSession(null);
      setRefreshQueued(false);
      setStatus('unauthenticated');
    });

    return () => {
      cancelled = true;
    };
  }, [isBootstrapped, refreshQueued, session]);

  const login = useCallback((displayName: string) => {
    const nextSession = createSession(displayName);
    setSession(nextSession);
    writeDashboardSession(nextSession);
    setRefreshQueued(false);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    writeDashboardSession(null);
    setRefreshQueued(false);
    setStatus('unauthenticated');
  }, []);

  const refreshSession = useCallback(() => {
    if (session) {
      setStatus('refreshing');
      setRefreshQueued(true);
    }
  }, [session]);

  const value = useMemo<DashboardAuthContextValue>(
    () => ({
      session,
      status,
      isBootstrapped,
      login,
      logout,
      refreshSession,
    }),
    [isBootstrapped, login, logout, refreshSession, session, status]
  );

  return <DashboardAuthContext.Provider value={value}>{children}</DashboardAuthContext.Provider>;
}

export function useDashboardAuth(): DashboardAuthContextValue {
  const context = useContext(DashboardAuthContext);

  if (!context) {
    throw new Error('useDashboardAuth must be used within DashboardAuthProvider');
  }

  return context;
}
