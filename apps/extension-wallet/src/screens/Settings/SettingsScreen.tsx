import * as React from 'react';
import { Globe, Lock, Timer, Key, FileText, Info } from 'lucide-react';
import { SettingsGroup, SettingItem } from '../../components/SettingsGroup';
import { NetworkSettings } from './NetworkSettings';
import { SecuritySettings } from './SecuritySettings';
import { AboutScreen } from './AboutScreen';
import { useSettings } from '../../hooks/useSettings';
import type { Network } from '@ancore/types';

type SettingsView = 'root' | 'network' | 'security' | 'about';

export function SettingsScreen() {
  const { settings, updateSettings } = useSettings();
  const [view, setView] = React.useState<SettingsView>('root');

  function handleNetworkChange(network: Network) {
    updateSettings({ network });
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
        onAutoLockChange={(autoLockTimeout) => updateSettings({ autoLockTimeout })}
        onBack={() => setView('root')}
      />
    );
  }

  if (view === 'about') {
    return <AboutScreen onBack={() => setView('root')} />;
  }

  const networkLabel = settings.network.charAt(0).toUpperCase() + settings.network.slice(1);

  const timeoutLabel = settings.autoLockTimeout === 0 ? 'Never' : `${settings.autoLockTimeout} min`;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-purple-800 px-5 pt-10 pb-8 text-white">
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-white/60 mt-0.5">Manage your wallet preferences</p>

        {/* Account card */}
        <div className="mt-5 flex items-center gap-3 rounded-xl bg-white/10 backdrop-blur px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white font-bold text-lg select-none">
            A
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">My Ancore Wallet</p>
            <p className="text-xs text-white/60 truncate">GBXXX...YYYY</p>
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
        <SettingsGroup title="Network">
          <SettingItem
            label="Network"
            description={`Currently on ${networkLabel}`}
            icon={<Globe className="h-4 w-4" />}
            value={networkLabel}
            onClick={() => setView('network')}
          />
        </SettingsGroup>

        <SettingsGroup title="Security">
          <SettingItem
            label="Change Password"
            description="Update your wallet password"
            icon={<Lock className="h-4 w-4" />}
            onClick={() => setView('security')}
          />
          <SettingItem
            label="Auto-lock Timeout"
            description="Lock wallet after inactivity"
            icon={<Timer className="h-4 w-4" />}
            value={timeoutLabel}
            onClick={() => setView('security')}
          />
          <SettingItem
            label="Export Private Key"
            description="Reveal your raw private key"
            icon={<Key className="h-4 w-4" />}
            onClick={() => setView('security')}
            danger
          />
          <SettingItem
            label="Export Recovery Phrase"
            description="Reveal your 12-word mnemonic"
            icon={<FileText className="h-4 w-4" />}
            onClick={() => setView('security')}
            danger
          />
        </SettingsGroup>

        <SettingsGroup title="About">
          <SettingItem
            label="About Ancore"
            description="Version, links & support"
            icon={<Info className="h-4 w-4" />}
            onClick={() => setView('about')}
          />
        </SettingsGroup>
      </div>
    </div>
  );
}
