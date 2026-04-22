/**
 * Settings Store (Zustand)
 *
 * Stores user preferences with persistence to extension storage.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { extensionStorage } from './_storage';

export type NetworkMode = 'mainnet' | 'testnet' | 'futurenet';
export type ThemePreference = 'light' | 'dark' | 'system';

export interface SettingsState {
  network: NetworkMode;
  theme: ThemePreference;
  autoLockMinutes: number;

  setNetwork: (network: NetworkMode) => void;
  setTheme: (theme: ThemePreference) => void;
  setAutoLockMinutes: (minutes: number) => void;
  reset: () => void;
}

const DEFAULTS = {
  network: 'testnet' as NetworkMode,
  theme: 'dark' as ThemePreference,
  autoLockMinutes: 15,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,

      setNetwork: (network) => set({ network }),
      setTheme: (theme) => set({ theme }),
      setAutoLockMinutes: (autoLockMinutes) => set({ autoLockMinutes }),
      reset: () => set(DEFAULTS),
    }),
    {
      name: 'ancore-settings',
      storage: createJSONStorage(() => extensionStorage),
    }
  )
);

export function getSettingsState() {
  return useSettingsStore.getState();
}

/** @deprecated Use useSettingsStore directly. Kept for router compatibility. */
export function initializeSettingsStore() {
  // No-op: Zustand persist handles hydration automatically.
}
