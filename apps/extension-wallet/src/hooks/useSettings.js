import { useState, useEffect, useCallback } from 'react';
const SETTINGS_STORAGE_KEY = 'ancore_settings';
const DEFAULT_SETTINGS = {
  network: 'testnet',
  autoLockTimeout: 5,
};
function readStorage() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}
function writeStorage(settings) {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
export function useSettings() {
  const [settings, setSettingsState] = useState(readStorage);
  useEffect(() => {
    writeStorage(settings);
  }, [settings]);
  const updateSettings = useCallback((patch) => {
    setSettingsState((prev) => ({ ...prev, ...patch }));
  }, []);
  return { settings, updateSettings };
}
//# sourceMappingURL=useSettings.js.map
