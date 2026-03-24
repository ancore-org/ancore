import * as React from 'react';

import { Bell, FileText, Globe, Info, Key, Lock, Timer } from 'lucide-react';
import { SettingItem, SettingsGroup } from '../../components/SettingsGroup';

import { AboutScreen } from './AboutScreen';
import type { Network } from '@ancore/types';
import { NetworkSettings } from './NetworkSettings';
import { SecuritySettings } from './SecuritySettings';
import { useToast } from '@ancore/ui-kit';
import { useSettings } from '../../hooks/useSettings';

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
      <div className="px-5 pt-10 pb-8 text-white bg-gradient-to-br from-primary to-purple-800">
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-white/60 mt-0.5">Manage your wallet preferences</p>

        {/* Account card */}
        <div className="flex items-center gap-3 px-4 py-3 mt-5 rounded-xl bg-white/10 backdrop-blur">
          <div className="flex items-center justify-center w-10 h-10 text-lg font-bold text-white rounded-full select-none bg-white/20">
            A
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">My Ancore Wallet</p>
            <p className="text-xs truncate text-white/60">GBXXX...YYYY</p>
          </div>
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${settings.network === 'mainnet' ? 'bg-green-400/20 text-green-300' : 'bg-yellow-400/20 text-yellow-300'}`}
          >
            {networkLabel}
          </span>
        </div>
      </div>

      {/* Settings groups */}
      <div className="flex-1 p-4 -mt-3 space-y-5 rounded-t-2xl bg-background">
        <SettingsGroup title="Network">
          <SettingItem
            label="Network"
            description={`Currently on ${networkLabel}`}
            icon={<Globe className="w-4 h-4" />}
            value={networkLabel}
            onClick={() => setView('network')}
          />
        </SettingsGroup>

        <SettingsGroup title="Security">
          <SettingItem
            label="Change Password"
            description="Update your wallet password"
            icon={<Lock className="w-4 h-4" />}
            onClick={() => setView('security')}
          />
          <SettingItem
            label="Auto-lock Timeout"
            description="Lock wallet after inactivity"
            icon={<Timer className="w-4 h-4" />}
            value={timeoutLabel}
            onClick={() => setView('security')}
          />
          <SettingItem
            label="Export Private Key"
            description="Reveal your raw private key"
            icon={<Key className="w-4 h-4" />}
            onClick={() => setView('security')}
            danger
          />
          <SettingItem
            label="Export Recovery Phrase"
            description="Reveal your 12-word mnemonic"
            icon={<FileText className="w-4 h-4" />}
            onClick={() => setView('security')}
            danger
          />
        </SettingsGroup>

        <SettingsGroup title="About">
          <SettingItem
            label="About Ancore"
            description="Version, links & support"
            icon={<Info className="w-4 h-4" />}
            onClick={() => setView('about')}
          />
        </SettingsGroup>

        <ToastDemo />
      </div>
    </div>
  );
}

function ToastDemo() {
  const { toast } = useToast();
  return (
    <SettingsGroup title="Notifications (Demo)">
      <SettingItem
        label="Success Toast"
        description="Payment sent successfully"
        icon={<Bell className="w-4 h-4" />}
        onClick={() => toast('Payment sent successfully!', 'success')}
      />
      <SettingItem
        label="Error Toast"
        description="Simulate a transaction error"
        icon={<Bell className="w-4 h-4" />}
        onClick={() => toast('Transaction failed. Please retry.', 'error')}
      />
      <SettingItem
        label="Info Toast"
        description="Address copied to clipboard"
        icon={<Bell className="w-4 h-4" />}
        onClick={() => toast('Address copied to clipboard', 'info')}
      />
    </SettingsGroup>
  );
}
