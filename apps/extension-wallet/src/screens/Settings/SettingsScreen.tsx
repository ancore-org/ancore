import * as React from 'react';

import {
  Globe,
  Lock,
  Timer,
  Key,
  FileText,
  Info,
  Bell,
  Monitor,
  Server,

  PanelRight,
} from 'lucide-react';

import { Globe, Lock, Timer, Key, FileText, Info, Bell, Monitor, Server, Shield } from 'lucide-react';

  Shield,
} from 'lucide-react';

import { useTranslation } from 'react-i18next';
import { SettingsGroup, SettingItem } from '../../components/SettingsGroup';
import { NetworkSettings } from './NetworkSettings';
import { SecuritySettings } from './SecuritySettings';
import { AboutScreen } from './AboutScreen';
import { EnvironmentSettings } from './EnvironmentSettings';
import { DisplaySettings } from './DisplaySettings';
import { ConnectedSitesScreen } from './ConnectedSitesScreen';
import { useSettings } from '../../hooks/useSettings';
import { DASHBOARD_SETTINGS_STORAGE_KEY } from '../../state/dashboard-settings';
import { useToast } from '@ancore/ui-kit';
import type { Network } from '@ancore/types';
import { useSettingsStore } from '../../stores/settings';
import {
  getAutoLockLabel,
  getDisplayLabel,
  getEnvironmentLabel,
  getNetworkLabel,
  getThemeLabel,
} from '../../i18n/settings-labels';

type SettingsView =
  | 'root'
  | 'network'
  | 'security'
  | 'environment'
  | 'display'
  | 'about'
  | 'connected-sites';

export function SettingsScreen() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const runtimeTheme = useSettingsStore((state) => state.theme);
  const setRuntimeTheme = useSettingsStore((state) => state.setTheme);
  const setRuntimeNetwork = useSettingsStore((state) => state.setNetwork);
  const setRuntimeAutoLockMinutes = useSettingsStore((state) => state.setAutoLockMinutes);
  const requirePasswordForSensitiveActions = useSettingsStore(
    (state) => state.requirePasswordForSensitiveActions
  );
  const setRequirePasswordForSensitiveActions = useSettingsStore(
    (state) => state.setRequirePasswordForSensitiveActions
  );
  const enableLockShortcut = useSettingsStore((state) => state.enableLockShortcut);
  const setEnableLockShortcut = useSettingsStore((state) => state.setEnableLockShortcut);
  const telemetryOptIn = useSettingsStore((state) => state.telemetryOptIn);
  const setTelemetryOptIn = useSettingsStore((state) => state.setTelemetryOptIn);
  const [view, setView] = React.useState<SettingsView>('root');

  React.useEffect(() => {
    if (typeof chrome === 'undefined') return;

    chrome.storage?.local?.set?.({
      [DASHBOARD_SETTINGS_STORAGE_KEY]: JSON.stringify({ state: settings }),
    });
  }, [settings]);

  function handleNetworkChange(network: Network) {
    updateSettings({ network });
    setRuntimeNetwork(network);
  }

  if (view === 'network') {
    return (
      <NetworkSettings
        value={settings.network}
        onChange={handleNetworkChange}
        onBack={() => setView('root')}
      />
    );
  }

  if (view === 'security') {
    return (
      <SecuritySettings
        autoLockTimeout={settings.autoLockTimeout}
        onAutoLockChange={(autoLockTimeout) => {
          updateSettings({ autoLockTimeout });
          setRuntimeAutoLockMinutes(autoLockTimeout);
        }}
        requirePasswordForSensitiveActions={requirePasswordForSensitiveActions}
        onRequirePasswordForSensitiveActionsChange={setRequirePasswordForSensitiveActions}
        enableLockShortcut={enableLockShortcut}
        onEnableLockShortcutChange={setEnableLockShortcut}
        onBack={() => setView('root')}
      />
    );
  }

  if (view === 'environment') {
    return (
      <EnvironmentSettings
        value={settings.environment}
        onChange={(environment) => updateSettings({ environment })}
        onBack={() => setView('root')}
      />
    );
  }

  if (view === 'display') {
    return (
      <DisplaySettings
        value={settings.displayPreference}
        onChange={(displayPreference) => updateSettings({ displayPreference })}
        theme={runtimeTheme}
        onThemeChange={setRuntimeTheme}
        onBack={() => setView('root')}
      />
    );
  }

  if (view === 'about') {
    return <AboutScreen onBack={() => setView('root')} />;
  }

  if (view === 'connected-sites') {
    return <ConnectedSitesScreen onBack={() => setView('root')} />;
  }

  const networkLabel = getNetworkLabel(settings.network, t);
  const timeoutLabel = getAutoLockLabel(settings.autoLockTimeout, t);
  const environmentLabel = getEnvironmentLabel(settings.environment, t);
  const displayLabel = getDisplayLabel(settings.displayPreference, t);
  const themeLabel = getThemeLabel(runtimeTheme, t);
  const approvalUxLabel =
    settings.approvalUx === 'sidePanel'
      ? t('settings.approvals.sidePanel')
      : t('settings.approvals.popup');

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-purple-800 px-5 pt-10 pb-8 text-white">
        <h1 className="text-xl font-bold tracking-tight">{t('settings.title')}</h1>
        <p className="text-sm text-white/60 mt-0.5">{t('settings.subtitle')}</p>

        {/* Account card */}
        <div className="mt-5 flex items-center gap-3 rounded-xl bg-white/10 backdrop-blur px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white font-bold text-lg select-none">
            A
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{t('settings.account.name')}</p>
            <p className="text-xs text-white/60 truncate">{t('settings.account.address')}</p>
          </div>
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${settings.network === 'mainnet' ? 'bg-green-400/20 text-green-300' : 'bg-yellow-400/20 text-yellow-300'}`}
          >
            {networkLabel}
          </span>
        </div>
      </div>

      {/* Settings groups */}
      <div className="flex-1 space-y-5 p-4 -mt-3 rounded-t-2xl bg-background">
        <SettingsGroup title={t('settings.groups.network')}>
          <SettingItem
            label={t('settings.network.label')}
            description={t('settings.network.currentlyOn', { network: networkLabel })}
            icon={<Globe className="h-4 w-4" />}
            value={networkLabel}
            onClick={() => setView('network')}
          />
          <SettingItem
            label={t('settings.environment.label')}
            description={t('settings.environment.usingEndpoints', {
              environment: environmentLabel.toLowerCase(),
            })}
            icon={<Server className="h-4 w-4" />}
            value={environmentLabel}
            onClick={() => setView('environment')}
          />
        </SettingsGroup>

        <SettingsGroup title={t('settings.groups.display')}>
          <SettingItem
            label={t('settings.display.label')}
            description={t('settings.display.description')}
            icon={<Monitor className="h-4 w-4" />}
            value={t('settings.display.value', { density: displayLabel, theme: themeLabel })}
            onClick={() => setView('display')}
          />
        </SettingsGroup>

        <SettingsGroup title={t('settings.groups.security')}>
          <SettingItem
            label={t('settings.approvals.label')}
            description={t('settings.approvals.description')}
            icon={<PanelRight className="h-4 w-4" />}
            value={approvalUxLabel}
            onClick={() =>
              updateSettings({
                approvalUx: settings.approvalUx === 'sidePanel' ? 'popup' : 'sidePanel',
              })
            }
          />
          <SettingItem
            label={t('settings.security.changePassword.label')}
            description={t('settings.security.changePassword.description')}
            icon={<Lock className="h-4 w-4" />}
            onClick={() => setView('security')}
          />
          <SettingItem
            label={t('settings.security.autoLock.label')}
            description={t('settings.security.autoLock.description')}
            icon={<Timer className="h-4 w-4" />}
            value={timeoutLabel}
            onClick={() => setView('security')}
          />
          <SettingItem
            label={t('settings.security.connectedSites.label')}
            description={t('settings.security.connectedSites.description')}
            icon={<Globe className="h-4 w-4" />}
            onClick={() => setView('connected-sites')}
          />
          <SettingItem
            label={t('settings.security.exportPrivateKey.label')}
            description={t('settings.security.exportPrivateKey.description')}
            icon={<Key className="h-4 w-4" />}
            onClick={() => setView('security')}
            danger
          />
          <SettingItem
            label={t('settings.security.exportRecoveryPhrase.label')}
            description={t('settings.security.exportRecoveryPhrase.description')}
            icon={<FileText className="h-4 w-4" />}
            onClick={() => setView('security')}
            danger
          />
        </SettingsGroup>

        <SettingsGroup title={t('settings.groups.privacy')}>
          <SettingItem
            label={t('settings.privacy.telemetry.label')}
            description={t('settings.privacy.telemetry.description')}
            icon={<Shield className="h-4 w-4" />}
            value={
              telemetryOptIn
                ? t('settings.privacy.telemetry.enabled')
                : t('settings.privacy.telemetry.disabled')
            }
            onClick={() => setTelemetryOptIn(!telemetryOptIn)}
          />
        </SettingsGroup>

        <SettingsGroup title={t('settings.groups.about')}>
          <SettingItem
            label={t('settings.about.label')}
            description={t('settings.about.description')}
            icon={<Info className="h-4 w-4" />}
            onClick={() => setView('about')}
          />
        </SettingsGroup>

        <ToastDemo />
      </div>
    </div>
  );
}

function ToastDemo() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return (
    <SettingsGroup title={t('settings.groups.notificationsDemo')}>
      <SettingItem
        label={t('settings.toastDemo.success.label')}
        description={t('settings.toastDemo.success.description')}
        icon={<Bell className="h-4 w-4" />}
        onClick={() => toast(t('settings.toastDemo.success.message'), 'success')}
      />
      <SettingItem
        label={t('settings.toastDemo.error.label')}
        description={t('settings.toastDemo.error.description')}
        icon={<Bell className="h-4 w-4" />}
        onClick={() => toast(t('settings.toastDemo.error.message'), 'error')}
      />
      <SettingItem
        label={t('settings.toastDemo.info.label')}
        description={t('settings.toastDemo.info.description')}
        icon={<Bell className="h-4 w-4" />}
        onClick={() => toast(t('settings.toastDemo.info.message'), 'info')}
      />
    </SettingsGroup>
  );
}
