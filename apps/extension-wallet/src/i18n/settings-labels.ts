import type { TFunction } from 'i18next';
import type { Network } from '@ancore/types';

type Environment = 'production' | 'staging';
type DisplayPreference = 'comfortable' | 'compact';
type ThemePreference = 'light' | 'dark' | 'system';

export function getNetworkLabel(network: Network, t: TFunction): string {
  switch (network) {
    case 'mainnet':
      return t('settings.network.mainnet');
    case 'testnet':
      return t('settings.network.testnet');
    case 'local':
      return t('settings.network.local');
    default:
      return network;
  }
}

export function getEnvironmentLabel(environment: Environment, t: TFunction): string {
  switch (environment) {
    case 'production':
      return t('settings.environment.production');
    case 'staging':
      return t('settings.environment.staging');
    default:
      return environment;
  }
}

export function getDisplayLabel(displayPreference: DisplayPreference, t: TFunction): string {
  switch (displayPreference) {
    case 'comfortable':
      return t('settings.display.comfortable');
    case 'compact':
      return t('settings.display.compact');
    default:
      return displayPreference;
  }
}

export function getThemeLabel(theme: ThemePreference, t: TFunction): string {
  switch (theme) {
    case 'light':
      return t('settings.theme.light');
    case 'dark':
      return t('settings.theme.dark');
    case 'system':
      return t('settings.theme.system');
    default:
      return theme;
  }
}

export function getAutoLockLabel(minutes: number, t: TFunction): string {
  if (minutes === 0) {
    return t('settings.security.autoLock.never');
  }

  return t('settings.security.autoLock.minutes', { count: minutes });
}
