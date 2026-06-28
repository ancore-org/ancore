import { useCallback } from 'react';
import type { Network } from '@ancore/types';
import {
  useDashboardSettingsStore,
  type DashboardEnvironment,
  type DisplayPreference,
  type ApprovalUxPreference,
} from '../state/dashboard-settings';

export interface Settings {
  network: Network;
  environment: DashboardEnvironment;
  displayPreference: DisplayPreference;
  autoLockTimeout: number;
  approvalUx: ApprovalUxPreference;
}

export function useSettings() {
  const network = useDashboardSettingsStore((state) => state.network);
  const environment = useDashboardSettingsStore((state) => state.environment);
  const displayPreference = useDashboardSettingsStore((state) => state.displayPreference);
  const autoLockTimeout = useDashboardSettingsStore((state) => state.autoLockTimeout);
  const approvalUx = useDashboardSettingsStore((state) => state.approvalUx);
  const setAll = useDashboardSettingsStore((state) => state.setAll);

  const settings: Settings = {
    network,
    environment,
    displayPreference,
    autoLockTimeout,
    approvalUx,
  };

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setAll(patch);
    },
    [setAll]
  );

  return { settings, updateSettings };
}
