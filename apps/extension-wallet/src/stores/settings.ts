/**
 * Settings Store (Zustand)
 *
 * Stores user preferences with persistence to extension storage.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { extensionStorage } from './_storage';
import { validateHorizonUrl, isValidHorizonUrl } from '@ancore/stellar';

export type NetworkMode = 'mainnet' | 'testnet' | 'futurenet';
export type ThemePreference = 'light' | 'dark' | 'system';

export type NotificationCategory = 'sent' | 'received' | 'failed' | 'security';

export interface NotificationPreferences {
  sent: boolean;
  received: boolean;
  failed: boolean;
  security: boolean;
}

export interface SettingsState {
  network: NetworkMode;
  horizonUrl: string;
  theme: ThemePreference;
  autoLockMinutes: number;
  requirePasswordForSensitiveActions: boolean;
  notificationPreferences: NotificationPreferences;
  dailyTransferLimit: number;
  transferStepUpThreshold: number;
  enableLockShortcut: boolean;

  setNetwork: (network: NetworkMode) => void;
  setTheme: (theme: ThemePreference) => void;
  setAutoLockMinutes: (minutes: number) => void;
  setRequirePasswordForSensitiveActions: (value: boolean) => void;
  setNotificationPreference: (category: NotificationCategory, enabled: boolean) => void;
  setDailyTransferLimit: (amount: number) => void;
  setTransferStepUpThreshold: (amount: number) => void;
  setEnableLockShortcut: (value: boolean) => void;
  /**
   * Override the Horizon URL for the currently selected network.
   * Validates the URL against the active network profile before applying.
   * Throws HorizonUrlValidationError if the URL is invalid for the network.
   */
  setHorizonUrl: (url: string) => void;
  reset: () => void;
}

/**
 * Horizon URL defaults for each network.
 * These are coupled with network selection to ensure service URLs stay in sync.
 */
const NETWORK_HORIZON_URLS: Record<NetworkMode, string> = {
  mainnet: 'https://horizon.stellar.org',
  testnet: 'https://horizon-testnet.stellar.org',
  futurenet: 'https://horizon-futurenet.stellar.org',
};

/**
 * Defaults used when keys are missing from persisted state.
 * Migration behavior:
 * - Older persisted blobs that do not include newer keys are merged with these defaults.
 * - Invalid values are coerced to defaults to prevent unsafe runtime assumptions.
 */
export const DEFAULTS = {
  network: 'testnet' as NetworkMode,
  horizonUrl: NETWORK_HORIZON_URLS.testnet,
  theme: 'dark' as ThemePreference,
  autoLockMinutes: 15,
  requirePasswordForSensitiveActions: true,
  notificationPreferences: {
    sent: true,
    received: true,
    failed: true,
    security: true,
  } as NotificationPreferences,
  dailyTransferLimit: 1000,
  transferStepUpThreshold: 250,
  enableLockShortcut: true,
};

const STORE_VERSION = 3;

function applyTheme(theme: ThemePreference): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,

      setNetwork: (network) =>
        set(() => ({
          network,
          horizonUrl: NETWORK_HORIZON_URLS[network],
        })),
      setHorizonUrl: (url) =>
        set((state) => {
          // Validate against the current network profile before persisting.
          // Throws HorizonUrlValidationError if the URL is invalid.
          validateHorizonUrl(url, state.network as 'mainnet' | 'testnet' | 'futurenet' | 'local');
          return { horizonUrl: url };
        }),
      setTheme: (theme) =>
        set(() => {
          applyTheme(theme);
          return { theme };
        }),
      setAutoLockMinutes: (autoLockMinutes) => set({ autoLockMinutes }),
      setRequirePasswordForSensitiveActions: (requirePasswordForSensitiveActions) =>
        set({ requirePasswordForSensitiveActions }),
      setNotificationPreference: (category, enabled) =>
        set((state) => ({
          notificationPreferences: {
            ...state.notificationPreferences,
            [category]: enabled,
          },
        })),
      setDailyTransferLimit: (dailyTransferLimit) => set({ dailyTransferLimit }),
      setTransferStepUpThreshold: (transferStepUpThreshold) => set({ transferStepUpThreshold }),
      setEnableLockShortcut: (enableLockShortcut) => set({ enableLockShortcut }),
      reset: () => set(DEFAULTS),
    }),
    {
      name: 'ancore-settings',
      version: STORE_VERSION,
      storage: createJSONStorage(() => extensionStorage),
      partialize: (state) => ({
        network: state.network,
        horizonUrl: state.horizonUrl,
        theme: state.theme,
        autoLockMinutes: state.autoLockMinutes,
        requirePasswordForSensitiveActions: state.requirePasswordForSensitiveActions,
        dailyTransferLimit: state.dailyTransferLimit,
        transferStepUpThreshold: state.transferStepUpThreshold,
        enableLockShortcut: state.enableLockShortcut,
      }),
      migrate: (persistedState) => persistedState as SettingsState,
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<SettingsState> | undefined) ?? {};
        const network = persisted.network;
        const theme = persisted.theme;
        const autoLockMinutes = persisted.autoLockMinutes;
        const dailyTransferLimit = persisted.dailyTransferLimit;
        const transferStepUpThreshold = persisted.transferStepUpThreshold;
        const horizonUrl = persisted.horizonUrl;

        // Validate network and derive horizon URL if missing or invalid
        const validNetwork =
          network === 'mainnet' || network === 'testnet' || network === 'futurenet'
            ? network
            : DEFAULTS.network;

        // If horizonUrl is missing, invalid, or fails URL validation for the network, derive from network
        const candidateUrl =
          horizonUrl && typeof horizonUrl === 'string' && horizonUrl.length > 0
            ? horizonUrl
            : NETWORK_HORIZON_URLS[validNetwork];
        const validHorizonUrl = isValidHorizonUrl(candidateUrl, validNetwork)
          ? candidateUrl
          : NETWORK_HORIZON_URLS[validNetwork];

        return {
          ...currentState,
          ...persisted,
          network: validNetwork,
          horizonUrl: validHorizonUrl,
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
          dailyTransferLimit:
            typeof dailyTransferLimit === 'number' && dailyTransferLimit >= 0
              ? dailyTransferLimit
              : DEFAULTS.dailyTransferLimit,
          transferStepUpThreshold:
            typeof transferStepUpThreshold === 'number' && transferStepUpThreshold >= 0
              ? transferStepUpThreshold
              : DEFAULTS.transferStepUpThreshold,
          enableLockShortcut:
            typeof persisted.enableLockShortcut === 'boolean'
              ? persisted.enableLockShortcut
              : DEFAULTS.enableLockShortcut,
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
