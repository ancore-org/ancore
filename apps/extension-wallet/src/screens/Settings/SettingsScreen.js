import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import * as React from 'react';
import { Globe, Lock, Timer, Key, FileText, Info } from 'lucide-react';
import { SettingsGroup, SettingItem } from '../../components/SettingsGroup';
import { NetworkSettings } from './NetworkSettings';
import { SecuritySettings } from './SecuritySettings';
import { AboutScreen } from './AboutScreen';
import { useSettings } from '../../hooks/useSettings';
export function SettingsScreen() {
  const { settings, updateSettings } = useSettings();
  const [view, setView] = React.useState('root');
  function handleNetworkChange(network) {
    updateSettings({ network });
  }
  if (view === 'network') {
    return _jsx(NetworkSettings, {
      value: settings.network,
      onChange: handleNetworkChange,
      onBack: () => setView('root'),
    });
  }
  if (view === 'security') {
    return _jsx(SecuritySettings, {
      autoLockTimeout: settings.autoLockTimeout,
      onAutoLockChange: (autoLockTimeout) => updateSettings({ autoLockTimeout }),
      onBack: () => setView('root'),
    });
  }
  if (view === 'about') {
    return _jsx(AboutScreen, { onBack: () => setView('root') });
  }
  const networkLabel = settings.network.charAt(0).toUpperCase() + settings.network.slice(1);
  const timeoutLabel = settings.autoLockTimeout === 0 ? 'Never' : `${settings.autoLockTimeout} min`;
  return _jsxs('div', {
    className: 'flex flex-col min-h-screen bg-background',
    children: [
      _jsxs('div', {
        className: 'bg-gradient-to-br from-primary to-purple-800 px-5 pt-10 pb-8 text-white',
        children: [
          _jsx('h1', { className: 'text-xl font-bold tracking-tight', children: 'Settings' }),
          _jsx('p', {
            className: 'text-sm text-white/60 mt-0.5',
            children: 'Manage your wallet preferences',
          }),
          _jsxs('div', {
            className:
              'mt-5 flex items-center gap-3 rounded-xl bg-white/10 backdrop-blur px-4 py-3',
            children: [
              _jsx('div', {
                className:
                  'flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white font-bold text-lg select-none',
                children: 'A',
              }),
              _jsxs('div', {
                className: 'flex-1 min-w-0',
                children: [
                  _jsx('p', {
                    className: 'text-sm font-semibold truncate',
                    children: 'My Ancore Wallet',
                  }),
                  _jsx('p', {
                    className: 'text-xs text-white/60 truncate',
                    children: 'GBXXX...YYYY',
                  }),
                ],
              }),
              _jsx('span', {
                className: `text-[10px] font-semibold px-2 py-0.5 rounded-full ${settings.network === 'mainnet' ? 'bg-green-400/20 text-green-300' : 'bg-yellow-400/20 text-yellow-300'}`,
                children: networkLabel,
              }),
            ],
          }),
        ],
      }),
      _jsxs('div', {
        className: 'flex-1 space-y-5 p-4 -mt-3 rounded-t-2xl bg-background',
        children: [
          _jsx(SettingsGroup, {
            title: 'Network',
            children: _jsx(SettingItem, {
              label: 'Network',
              description: `Currently on ${networkLabel}`,
              icon: _jsx(Globe, { className: 'h-4 w-4' }),
              value: networkLabel,
              onClick: () => setView('network'),
            }),
          }),
          _jsxs(SettingsGroup, {
            title: 'Security',
            children: [
              _jsx(SettingItem, {
                label: 'Change Password',
                description: 'Update your wallet password',
                icon: _jsx(Lock, { className: 'h-4 w-4' }),
                onClick: () => setView('security'),
              }),
              _jsx(SettingItem, {
                label: 'Auto-lock Timeout',
                description: 'Lock wallet after inactivity',
                icon: _jsx(Timer, { className: 'h-4 w-4' }),
                value: timeoutLabel,
                onClick: () => setView('security'),
              }),
              _jsx(SettingItem, {
                label: 'Export Private Key',
                description: 'Reveal your raw private key',
                icon: _jsx(Key, { className: 'h-4 w-4' }),
                onClick: () => setView('security'),
                danger: true,
              }),
              _jsx(SettingItem, {
                label: 'Export Recovery Phrase',
                description: 'Reveal your 12-word mnemonic',
                icon: _jsx(FileText, { className: 'h-4 w-4' }),
                onClick: () => setView('security'),
                danger: true,
              }),
            ],
          }),
          _jsx(SettingsGroup, {
            title: 'About',
            children: _jsx(SettingItem, {
              label: 'About Ancore',
              description: 'Version, links & support',
              icon: _jsx(Info, { className: 'h-4 w-4' }),
              onClick: () => setView('about'),
            }),
          }),
        ],
      }),
    ],
  });
}
//# sourceMappingURL=SettingsScreen.js.map
