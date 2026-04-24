import { useCallback } from 'react';
import type { Network } from '@ancore/types';
import {
  useDashboardSettingsStore,
  type DashboardEnvironment,
  type DisplayPreference,
} from '../state/dashboard-settings';

export interface Settings {
  network: Network;
  environment: DashboardEnvironment;
  displayPreference: DisplayPreference;
  autoLockTimeout: number;
}

export function useSettings() {
  const network = useDashboardSettingsStore((state) => state.network);
  const environment = useDashboardSettingsStore((state) => state.environment);
  const displayPreference = useDashboardSettingsStore((state) => state.displayPreference);
  const autoLockTimeout = useDashboardSettingsStore((state) => state.autoLockTimeout);
  const setAll = useDashboardSettingsStore((state) => state.setAll);

  const settings: Settings = {
    network,
    environment,
    displayPreference,
    autoLockTimeout,
  };

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setAll(patch);
    },
    [setAll]
  );

  return { settings, updateSettings };
}
