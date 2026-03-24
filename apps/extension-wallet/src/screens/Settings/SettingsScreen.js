import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import * as React from 'react';
import { Bell, FileText, Globe, Info, Key, Lock, Timer } from 'lucide-react';
import { SettingItem, SettingsGroup } from '../../components/SettingsGroup';
import { AboutScreen } from './AboutScreen';
import { NetworkSettings } from './NetworkSettings';
import { SecuritySettings } from './SecuritySettings';
import { useSettings } from '../../hooks/useSettings';
import { useToast } from '@ancore/ui-kit';
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
        className: 'px-5 pt-10 pb-8 text-white bg-gradient-to-br from-primary to-purple-800',
        children: [
          _jsx('h1', { className: 'text-xl font-bold tracking-tight', children: 'Settings' }),
          _jsx('p', {
            className: 'text-sm text-white/60 mt-0.5',
            children: 'Manage your wallet preferences',
          }),
          _jsxs('div', {
            className:
              'flex items-center gap-3 px-4 py-3 mt-5 rounded-xl bg-white/10 backdrop-blur',
            children: [
              _jsx('div', {
                className:
                  'flex items-center justify-center w-10 h-10 text-lg font-bold text-white rounded-full select-none bg-white/20',
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
                    className: 'text-xs truncate text-white/60',
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
        className: 'flex-1 p-4 -mt-3 space-y-5 rounded-t-2xl bg-background',
        children: [
          _jsx(SettingsGroup, {
            title: 'Network',
            children: _jsx(SettingItem, {
              label: 'Network',
              description: `Currently on ${networkLabel}`,
              icon: _jsx(Globe, { className: 'w-4 h-4' }),
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
                icon: _jsx(Lock, { className: 'w-4 h-4' }),
                onClick: () => setView('security'),
              }),
              _jsx(SettingItem, {
                label: 'Auto-lock Timeout',
                description: 'Lock wallet after inactivity',
                icon: _jsx(Timer, { className: 'w-4 h-4' }),
                value: timeoutLabel,
                onClick: () => setView('security'),
              }),
              _jsx(SettingItem, {
                label: 'Export Private Key',
                description: 'Reveal your raw private key',
                icon: _jsx(Key, { className: 'w-4 h-4' }),
                onClick: () => setView('security'),
                danger: true,
              }),
              _jsx(SettingItem, {
                label: 'Export Recovery Phrase',
                description: 'Reveal your 12-word mnemonic',
                icon: _jsx(FileText, { className: 'w-4 h-4' }),
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
              icon: _jsx(Info, { className: 'w-4 h-4' }),
              onClick: () => setView('about'),
            }),
          }),
          _jsx(ToastDemo, {}),
        ],
      }),
    ],
  });
}
function ToastDemo() {
  const { toast } = useToast();
  return _jsxs(SettingsGroup, {
    title: 'Notifications (Demo)',
    children: [
      _jsx(SettingItem, {
        label: 'Success Toast',
        description: 'Payment sent successfully',
        icon: _jsx(Bell, { className: 'w-4 h-4' }),
        onClick: () => toast('Payment sent successfully!', 'success'),
      }),
      _jsx(SettingItem, {
        label: 'Error Toast',
        description: 'Simulate a transaction error',
        icon: _jsx(Bell, { className: 'w-4 h-4' }),
        onClick: () => toast('Transaction failed. Please retry.', 'error'),
      }),
      _jsx(SettingItem, {
        label: 'Info Toast',
        description: 'Address copied to clipboard',
        icon: _jsx(Bell, { className: 'w-4 h-4' }),
        onClick: () => toast('Address copied to clipboard', 'info'),
      }),
    ],
  });
}
//# sourceMappingURL=SettingsScreen.js.map
