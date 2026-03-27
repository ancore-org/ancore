import { useSyncExternalStore } from 'react';

export type AppRoute = 'home' | 'accounts' | 'settings';
export type SessionStatus = 'locked' | 'unlocking' | 'ready';

export interface SessionState {
  currentRoute: AppRoute;
  status: SessionStatus;
  lastActiveAt: number | null;
}

type SessionUpdater = Partial<SessionState> | ((state: SessionState) => SessionState);

const listeners = new Set<() => void>();

let sessionState: SessionState = {
  currentRoute: 'home',
  status: 'locked',
  lastActiveAt: null,
};

function emitChange() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getSessionState(): SessionState {
  return sessionState;
}

export function setSessionState(next: SessionUpdater) {
  sessionState =
    typeof next === 'function'
      ? next(sessionState)
      : {
          ...sessionState,
          ...next,
        };

  emitChange();
}

export function useSessionStore(): SessionState {
  return useSyncExternalStore(subscribe, getSessionState, getSessionState);
}
