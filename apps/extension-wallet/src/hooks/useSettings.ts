import { useState, useEffect, useCallback } from 'react';
import type { Network } from '@ancore/types';

export interface Settings {
  network: Network;
  autoLockTimeout: number; // minutes; 0 = never
}

const SETTINGS_STORAGE_KEY = 'ancore_settings';

const DEFAULT_SETTINGS: Settings = {
  network: 'testnet',
  autoLockTimeout: 5,
};

function readStorage(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeStorage(settings: Settings): void {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings>(readStorage);

  useEffect(() => {
    writeStorage(settings);
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState((prev) => ({ ...prev, ...patch }));
  }, []);

  return { settings, updateSettings };
}
