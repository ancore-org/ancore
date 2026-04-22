/**
 * Session Store (Zustand)
 *
 * Tracks runtime session state: current route, lock status, and last activity.
 * Not persisted — resets on each popup open.
 */

import { create } from 'zustand';

export type AppRoute = 'home' | 'accounts' | 'settings';
export type SessionStatus = 'locked' | 'unlocking' | 'ready';

export interface SessionState {
  currentRoute: AppRoute;
  status: SessionStatus;
  lastActiveAt: number | null;

  navigate: (route: AppRoute) => void;
  setStatus: (status: SessionStatus) => void;
  touch: () => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  currentRoute: 'home',
  status: 'locked',
  lastActiveAt: null,

  navigate: (route) => set({ currentRoute: route, lastActiveAt: Date.now() }),
  setStatus: (status) => set({ status }),
  touch: () => set({ lastActiveAt: Date.now() }),
}));

/** Direct state setter for non-React contexts (e.g. lock manager callbacks). */
export function setSessionState(
  updater: Partial<SessionState> | ((state: SessionState) => Partial<SessionState>)
) {
  useSessionStore.setState(updater as any);
}

export function getSessionState() {
  return useSessionStore.getState();
}
