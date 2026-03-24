import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import * as React from 'react';
import { AlertTriangle, ArrowLeft, Check, Wifi } from 'lucide-react';
import { Button } from '@ancore/ui-kit';
const NETWORKS = [
  {
    value: 'testnet',
    label: 'Testnet',
    description: 'Safe for testing — no real funds',
    color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  },
  {
    value: 'mainnet',
    label: 'Mainnet',
    description: 'Live network — real funds at risk',
    color: 'text-green-600 bg-green-50 border-green-200',
  },
];
export function NetworkSettings({ value, onChange, onBack }) {
  const [pending, setPending] = React.useState(null);
  function handleSelect(network) {
    if (network === value) return;
    if (network === 'mainnet') {
      setPending(network);
    } else {
      onChange(network);
      onBack();
    }
  }
  if (pending) {
    return _jsxs('div', {
      className: 'flex flex-col min-h-screen bg-background',
      children: [
        _jsx(ScreenHeader, { title: 'Switch Network', onBack: () => setPending(null) }),
        _jsxs('div', {
          className: 'flex flex-col gap-4 p-4',
          children: [
            _jsxs('div', {
              className:
                'flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4',
              children: [
                _jsx('div', {
                  className:
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10',
                  children: _jsx(AlertTriangle, { className: 'h-5 w-5 text-destructive' }),
                }),
                _jsxs('div', {
                  children: [
                    _jsx('p', {
                      className: 'font-semibold text-destructive text-sm',
                      children: 'Switch to Mainnet?',
                    }),
                    _jsx('p', {
                      className: 'text-xs text-muted-foreground mt-1 leading-relaxed',
                      children:
                        'Mainnet uses real funds. Transactions are irreversible. Only switch if you know what you are doing.',
                    }),
                  ],
                }),
              ],
            }),
            _jsx(Button, {
              variant: 'outline',
              className: 'w-full',
              onClick: () => setPending(null),
              children: 'Cancel',
            }),
            _jsx(Button, {
              variant: 'destructive',
              className: 'w-full',
              onClick: () => {
                onChange(pending);
                setPending(null);
                onBack();
              },
              children: 'Yes, Switch to Mainnet',
            }),
          ],
        }),
      ],
    });
  }
  return _jsxs('div', {
    className: 'flex flex-col min-h-screen bg-background',
    children: [
      _jsx(ScreenHeader, { title: 'Network', onBack: onBack }),
      _jsx('div', {
        className: 'flex flex-col gap-3 p-4',
        children: NETWORKS.map((n) => {
          const active = value === n.value;
          return _jsxs(
            'button',
            {
              onClick: () => handleSelect(n.value),
              className: `flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                active
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:border-primary/40 hover:bg-accent/30'
              }`,
              children: [
                _jsx('div', {
                  className: `flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${n.color}`,
                  children: _jsx(Wifi, { className: 'h-4 w-4' }),
                }),
                _jsxs('div', {
                  className: 'flex-1',
                  children: [
                    _jsx('p', { className: 'font-semibold text-sm', children: n.label }),
                    _jsx('p', {
                      className: 'text-xs text-muted-foreground mt-0.5',
                      children: n.description,
                    }),
                  ],
                }),
                active &&
                  _jsx('div', {
                    className: 'flex h-6 w-6 items-center justify-center rounded-full bg-primary',
                    children: _jsx(Check, { className: 'h-3.5 w-3.5 text-white' }),
                  }),
              ],
            },
            n.value
          );
        }),
      }),
    ],
  });
}
export function ScreenHeader({ title, onBack }) {
  return _jsxs('div', {
    className: 'flex items-center gap-3 px-4 py-4 border-b border-border bg-card',
    children: [
      _jsx('button', {
        onClick: onBack,
        className:
          'flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors',
        'aria-label': 'Go back',
        children: _jsx(ArrowLeft, { className: 'h-4 w-4' }),
      }),
      _jsx('h1', { className: 'font-semibold text-base', children: title }),
    ],
  });
}
//# sourceMappingURL=NetworkSettings.js.map
