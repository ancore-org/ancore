import { useSyncExternalStore } from 'react';

export type NetworkMode = 'mainnet' | 'testnet' | 'futurenet';
export type ThemePreference = 'light' | 'dark' | 'system';

export interface SettingsState {
  network: NetworkMode;
  theme: ThemePreference;
  autoLockMinutes: number;
  hydrated: boolean;
}

type SettingsUpdater = Partial<SettingsState> | ((state: SettingsState) => SettingsState);

const listeners = new Set<() => void>();

let settingsState: SettingsState = {
  network: 'testnet',
  theme: 'dark',
  autoLockMinutes: 15,
  hydrated: false,
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

export function getSettingsState(): SettingsState {
  return settingsState;
}

export function setSettingsState(next: SettingsUpdater) {
  settingsState =
    typeof next === 'function'
      ? next(settingsState)
      : {
          ...settingsState,
          ...next,
        };

  emitChange();
}

export function initializeSettingsStore() {
  if (settingsState.hydrated) {
    return;
  }

  setSettingsState({ hydrated: true });
}

export function useSettingsStore(): SettingsState {
  return useSyncExternalStore(subscribe, getSettingsState, getSettingsState);
}
