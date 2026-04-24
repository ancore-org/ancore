import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Network } from '@ancore/types';

export type DashboardEnvironment = 'production' | 'staging';
export type DisplayPreference = 'comfortable' | 'compact';

export interface DashboardSettingsState {
  network: Network;
  environment: DashboardEnvironment;
  displayPreference: DisplayPreference;
  autoLockTimeout: number;
  setNetwork: (network: Network) => void;
  setEnvironment: (environment: DashboardEnvironment) => void;
  setDisplayPreference: (displayPreference: DisplayPreference) => void;
  setAll: (settings: Partial<DashboardSettingsSnapshot>) => void;
}

export interface DashboardSettingsSnapshot {
  network: Network;
  environment: DashboardEnvironment;
  displayPreference: DisplayPreference;
  autoLockTimeout: number;
}

export const DEFAULT_DASHBOARD_SETTINGS: DashboardSettingsSnapshot = {
  network: 'testnet',
  environment: 'production',
  displayPreference: 'comfortable',
  autoLockTimeout: 5,
};

export const DASHBOARD_SETTINGS_STORAGE_KEY = 'ancore_dashboard_settings';

export const useDashboardSettingsStore = create<DashboardSettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_DASHBOARD_SETTINGS,
      setNetwork: (network) => set({ network }),
      setEnvironment: (environment) => set({ environment }),
      setDisplayPreference: (displayPreference) => set({ displayPreference }),
      setAll: (settings) => set((state) => ({ ...state, ...settings })),
    }),
    {
      name: DASHBOARD_SETTINGS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        network: state.network,
        environment: state.environment,
        displayPreference: state.displayPreference,
        autoLockTimeout: state.autoLockTimeout,
      }),
    }
  )
);
