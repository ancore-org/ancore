import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import * as React from 'react';
import { AlertTriangle, Eye, EyeOff, Check, Copy } from 'lucide-react';
import { Button, Input } from '@ancore/ui-kit';
import { ScreenHeader } from './NetworkSettings';
const TIMEOUT_OPTIONS = [
  { label: '1 minute', value: 1 },
  { label: '5 minutes', value: 5 },
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: 'Never', value: 0 },
];
// ── Change Password ──────────────────────────────────────────────────────────
function ChangePasswordView({ onDone }) {
  const [form, setForm] = React.useState({ current: '', next: '', confirm: '' });
  const [showNext, setShowNext] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState(false);
  function handleCurrentPasswordChange(event) {
    setForm((currentForm) => ({ ...currentForm, current: event.target.value }));
  }
  function handleNextPasswordChange(event) {
    setForm((currentForm) => ({ ...currentForm, next: event.target.value }));
  }
  function handleConfirmPasswordChange(event) {
    setForm((currentForm) => ({ ...currentForm, confirm: event.target.value }));
  }
  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.next.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (form.next !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSuccess(true);
  }
  if (success) {
    return _jsxs('div', {
      className: 'flex flex-col items-center gap-4 p-8 text-center',
      children: [
        _jsx('div', {
          className: 'flex h-16 w-16 items-center justify-center rounded-full bg-green-100',
          children: _jsx(Check, { className: 'h-8 w-8 text-green-600' }),
        }),
        _jsxs('div', {
          children: [
            _jsx('p', { className: 'font-semibold text-base', children: 'Password Updated' }),
            _jsx('p', {
              className: 'text-sm text-muted-foreground mt-1',
              children: 'Your wallet password has been changed successfully.',
            }),
          ],
        }),
        _jsx(Button, { className: 'w-full mt-2', onClick: onDone, children: 'Done' }),
      ],
    });
  }
  return _jsxs('form', {
    onSubmit: handleSubmit,
    className: 'flex flex-col gap-4 p-4',
    children: [
      _jsxs('div', {
        className: 'space-y-1',
        children: [
          _jsx('label', {
            className: 'text-xs font-medium text-muted-foreground uppercase tracking-wide',
            children: 'Current Password',
          }),
          _jsx(Input, {
            type: 'password',
            placeholder: 'Enter current password',
            value: form.current,
            onChange: handleCurrentPasswordChange,
          }),
        ],
      }),
      _jsxs('div', {
        className: 'space-y-1',
        children: [
          _jsx('label', {
            className: 'text-xs font-medium text-muted-foreground uppercase tracking-wide',
            children: 'New Password',
          }),
          _jsxs('div', {
            className: 'relative',
            children: [
              _jsx(Input, {
                type: showNext ? 'text' : 'password',
                placeholder: 'Min. 8 characters',
                value: form.next,
                onChange: handleNextPasswordChange,
                className: 'pr-10',
              }),
              _jsx('button', {
                type: 'button',
                className:
                  'absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground',
                onClick: () => setShowNext((s) => !s),
                children: showNext
                  ? _jsx(EyeOff, { className: 'h-4 w-4' })
                  : _jsx(Eye, { className: 'h-4 w-4' }),
              }),
            ],
          }),
        ],
      }),
      _jsxs('div', {
        className: 'space-y-1',
        children: [
          _jsx('label', {
            className: 'text-xs font-medium text-muted-foreground uppercase tracking-wide',
            children: 'Confirm New Password',
          }),
          _jsx(Input, {
            type: 'password',
            placeholder: 'Repeat new password',
            value: form.confirm,
            onChange: handleConfirmPasswordChange,
          }),
        ],
      }),
      error &&
        _jsxs('div', {
          className: 'flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2',
          children: [
            _jsx(AlertTriangle, { className: 'h-4 w-4 shrink-0 text-destructive' }),
            _jsx('p', { className: 'text-xs text-destructive', children: error }),
          ],
        }),
      _jsx(Button, { type: 'submit', className: 'w-full mt-1', children: 'Update Password' }),
    ],
  });
}
// ── Auto-lock ────────────────────────────────────────────────────────────────
function AutoLockView({ value, onChange, onDone }) {
  return _jsxs('div', {
    className: 'flex flex-col gap-2 p-4',
    children: [
      _jsx('p', {
        className: 'text-xs text-muted-foreground mb-1',
        children: 'Wallet will lock automatically after the selected period of inactivity.',
      }),
      _jsx('div', {
        className: 'rounded-xl border border-border bg-card overflow-hidden divide-y divide-border',
        children: TIMEOUT_OPTIONS.map((opt) =>
          _jsxs(
            'button',
            {
              className:
                'flex w-full items-center justify-between px-4 py-3.5 text-sm hover:bg-accent/50 transition-colors',
              onClick: () => {
                onChange(opt.value);
                onDone();
              },
              children: [
                _jsx('span', { className: 'font-medium', children: opt.label }),
                value === opt.value &&
                  _jsx('div', {
                    className: 'flex h-5 w-5 items-center justify-center rounded-full bg-primary',
                    children: _jsx(Check, {
                      className: 'h-3 w-3 text-white',
                      'aria-label': 'active',
                    }),
                  }),
              ],
            },
            opt.value
          )
        ),
      }),
    ],
  });
}
// ── Export warning wrapper ───────────────────────────────────────────────────
function ExportWarningView({ warningText, onConfirm, onCancel }) {
  const [password, setPassword] = React.useState('');
  const [confirmed, setConfirmed] = React.useState(false);
  const [secret] = React.useState('SCZANGBA5WGGU4NBKMJQJZ7WHKDXGZNZEBCV3LTXNZXR4XMXAMPLE');
  const [show, setShow] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState('');
  function handlePasswordChange(event) {
    setPassword(event.target.value);
  }
  function handleReveal(e) {
    e.preventDefault();
    if (!password) {
      setError('Enter your password.');
      return;
    }
    // TODO: decrypt vault with crypto package
    setConfirmed(true);
    setError('');
  }
  async function handleCopy() {
    await navigator.clipboard.writeText(secret).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  if (confirmed) {
    return _jsxs('div', {
      className: 'flex flex-col gap-4 p-4',
      children: [
        _jsxs('div', {
          className:
            'flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3',
          children: [
            _jsx(AlertTriangle, { className: 'mt-0.5 h-4 w-4 shrink-0 text-destructive' }),
            _jsx('p', {
              className: 'text-xs text-destructive leading-relaxed',
              children: 'Never share this with anyone. Anyone with this can steal all your funds.',
            }),
          ],
        }),
        _jsxs('div', {
          className:
            'relative rounded-xl border border-border bg-muted p-4 font-mono text-xs break-all leading-relaxed',
          children: [
            show ? secret : '•'.repeat(secret.length),
            _jsxs('div', {
              className: 'flex gap-2 mt-3 justify-end',
              children: [
                _jsxs('button', {
                  type: 'button',
                  onClick: () => setShow((s) => !s),
                  className:
                    'flex items-center gap-1.5 rounded-lg bg-background border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors',
                  children: [
                    show
                      ? _jsx(EyeOff, { className: 'h-3.5 w-3.5' })
                      : _jsx(Eye, { className: 'h-3.5 w-3.5' }),
                    show ? 'Hide' : 'Reveal',
                  ],
                }),
                _jsxs('button', {
                  type: 'button',
                  onClick: handleCopy,
                  className:
                    'flex items-center gap-1.5 rounded-lg bg-background border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors',
                  children: [
                    copied
                      ? _jsx(Check, { className: 'h-3.5 w-3.5 text-green-500' })
                      : _jsx(Copy, { className: 'h-3.5 w-3.5' }),
                    copied ? 'Copied' : 'Copy',
                  ],
                }),
              ],
            }),
          ],
        }),
        _jsx(Button, {
          variant: 'outline',
          className: 'w-full',
          onClick: onConfirm,
          children: 'Done',
        }),
      ],
    });
  }
  return _jsxs('form', {
    onSubmit: handleReveal,
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
                children: 'Sensitive Information',
              }),
              _jsx('p', {
                className: 'text-xs text-muted-foreground mt-1 leading-relaxed',
                children: warningText,
              }),
            ],
          }),
        ],
      }),
      _jsxs('div', {
        className: 'space-y-1',
        children: [
          _jsx('label', {
            className: 'text-xs font-medium text-muted-foreground uppercase tracking-wide',
            children: 'Confirm Password',
          }),
          _jsx(Input, {
            type: 'password',
            placeholder: 'Enter password to continue',
            value: password,
            onChange: handlePasswordChange,
          }),
        ],
      }),
      error && _jsx('p', { className: 'text-xs text-destructive', children: error }),
      _jsxs('div', {
        className: 'flex gap-2 mt-1',
        children: [
          _jsx(Button, {
            type: 'button',
            variant: 'outline',
            className: 'flex-1',
            onClick: onCancel,
            children: 'Cancel',
          }),
          _jsx(Button, {
            type: 'submit',
            variant: 'destructive',
            className: 'flex-1',
            children: 'Reveal',
          }),
        ],
      }),
    ],
  });
}
// ── SecuritySettings root ────────────────────────────────────────────────────
export function SecuritySettings({ autoLockTimeout, onAutoLockChange, onBack }) {
  const [view, setView] = React.useState('menu');
  const titles = {
    menu: 'Security',
    'change-password': 'Change Password',
    'auto-lock': 'Auto-lock Timeout',
    'export-key': 'Export Private Key',
    'export-mnemonic': 'Export Recovery Phrase',
  };
  function handleBack() {
    if (view === 'menu') onBack();
    else setView('menu');
  }
  return _jsxs('div', {
    className: 'flex flex-col min-h-screen bg-background',
    children: [
      _jsx(ScreenHeader, { title: titles[view], onBack: handleBack }),
      view === 'menu' &&
        _jsx(SecurityMenu, { autoLockTimeout: autoLockTimeout, onNavigate: setView }),
      view === 'change-password' && _jsx(ChangePasswordView, { onDone: () => setView('menu') }),
      view === 'auto-lock' &&
        _jsx(AutoLockView, {
          value: autoLockTimeout,
          onChange: onAutoLockChange,
          onDone: () => setView('menu'),
        }),
      view === 'export-key' &&
        _jsx(ExportWarningView, {
          title: 'Export Private Key',
          warningText:
            'Your private key grants full control of your account. Anyone with it can steal your funds immediately.',
          onConfirm: () => setView('menu'),
          onCancel: () => setView('menu'),
        }),
      view === 'export-mnemonic' &&
        _jsx(ExportWarningView, {
          title: 'Export Recovery Phrase',
          warningText:
            'Your recovery phrase can restore your entire wallet. Keep it offline, never share it with anyone.',
          onConfirm: () => setView('menu'),
          onCancel: () => setView('menu'),
        }),
    ],
  });
}
function SecurityMenu({ autoLockTimeout, onNavigate }) {
  const timeoutLabel = TIMEOUT_OPTIONS.find((o) => o.value === autoLockTimeout)?.label ?? 'Custom';
  return _jsxs('div', {
    className: 'flex flex-col gap-4 p-4',
    children: [
      _jsxs('div', {
        className: 'rounded-xl border border-border bg-card overflow-hidden divide-y divide-border',
        children: [
          _jsx(MenuItem, {
            label: 'Change Password',
            description: 'Update your wallet password',
            onClick: () => onNavigate('change-password'),
          }),
          _jsx(MenuItem, {
            label: 'Auto-lock Timeout',
            description: 'Lock after inactivity',
            value: timeoutLabel,
            onClick: () => onNavigate('auto-lock'),
          }),
        ],
      }),
      _jsx('p', {
        className: 'px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground',
        children: 'Danger Zone',
      }),
      _jsxs('div', {
        className:
          'rounded-xl border border-destructive/30 bg-card overflow-hidden divide-y divide-destructive/10',
        children: [
          _jsx(MenuItem, {
            label: 'Export Private Key',
            description: 'Reveal your raw private key',
            onClick: () => onNavigate('export-key'),
            danger: true,
          }),
          _jsx(MenuItem, {
            label: 'Export Recovery Phrase',
            description: 'Reveal your 12-word mnemonic',
            onClick: () => onNavigate('export-mnemonic'),
            danger: true,
          }),
        ],
      }),
    ],
  });
}
function MenuItem({ label, description, value, onClick, danger = false }) {
  return _jsxs('button', {
    className: `flex w-full items-center justify-between px-4 py-3.5 text-sm hover:bg-accent/50 transition-colors ${danger ? 'text-destructive' : ''}`,
    onClick: onClick,
    children: [
      _jsxs('span', {
        className: 'text-left',
        children: [
          _jsx('span', { className: 'block font-medium', children: label }),
          description &&
            _jsx('span', {
              className: 'block text-xs text-muted-foreground mt-0.5',
              children: description,
            }),
        ],
      }),
      value
        ? _jsx('span', {
            className: 'text-xs text-muted-foreground ml-2 shrink-0',
            children: value,
          })
        : _jsx('span', { className: 'text-muted-foreground/40 ml-2', children: '\u203A' }),
    ],
  });
}
//# sourceMappingURL=SecuritySettings.js.map
