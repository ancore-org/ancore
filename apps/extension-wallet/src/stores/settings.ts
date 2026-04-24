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
  requirePasswordForSensitiveActions: boolean;

  setNetwork: (network: NetworkMode) => void;
  setTheme: (theme: ThemePreference) => void;
  setAutoLockMinutes: (minutes: number) => void;
  setRequirePasswordForSensitiveActions: (value: boolean) => void;
  reset: () => void;
}

/**
 * Defaults used when keys are missing from persisted state.
 * Migration behavior:
 * - Older persisted blobs that do not include newer keys are merged with these defaults.
 * - Invalid values are coerced to defaults to prevent unsafe runtime assumptions.
 */
export const DEFAULTS = {
  network: 'testnet' as NetworkMode,
  theme: 'dark' as ThemePreference,
  autoLockMinutes: 15,
  requirePasswordForSensitiveActions: true,
};

const STORE_VERSION = 2;

function applyTheme(theme: ThemePreference): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,

      setNetwork: (network) => set({ network }),
      setTheme: (theme) =>
        set(() => {
          applyTheme(theme);
          return { theme };
        }),
      setAutoLockMinutes: (autoLockMinutes) => set({ autoLockMinutes }),
      setRequirePasswordForSensitiveActions: (requirePasswordForSensitiveActions) =>
        set({ requirePasswordForSensitiveActions }),
      reset: () => set(DEFAULTS),
    }),
    {
      name: 'ancore-settings',
      version: STORE_VERSION,
      storage: createJSONStorage(() => extensionStorage),
      partialize: (state) => ({
        network: state.network,
        theme: state.theme,
        autoLockMinutes: state.autoLockMinutes,
        requirePasswordForSensitiveActions: state.requirePasswordForSensitiveActions,
      }),
      migrate: (persistedState) => persistedState as SettingsState,
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<SettingsState> | undefined) ?? {};
        const network = persisted.network;
        const theme = persisted.theme;
        const autoLockMinutes = persisted.autoLockMinutes;

        return {
          ...currentState,
          ...persisted,
          network:
            network === 'mainnet' || network === 'testnet' || network === 'futurenet'
              ? network
              : DEFAULTS.network,
          theme:
            theme === 'light' || theme === 'dark' || theme === 'system' ? theme : DEFAULTS.theme,
          autoLockMinutes:
            typeof autoLockMinutes === 'number' && autoLockMinutes >= 0
              ? autoLockMinutes
              : DEFAULTS.autoLockMinutes,
          requirePasswordForSensitiveActions:
            typeof persisted.requirePasswordForSensitiveActions === 'boolean'
              ? persisted.requirePasswordForSensitiveActions
              : DEFAULTS.requirePasswordForSensitiveActions,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        applyTheme(state.theme);
      },
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
