import * as React from 'react';
import { AlertTriangle, Eye, EyeOff, Check, Copy } from 'lucide-react';
import { Button, Input } from '@ancore/ui-kit';
import { ScreenHeader } from './NetworkSettings';

type SecurityView = 'menu' | 'change-password' | 'auto-lock' | 'export-key' | 'export-mnemonic';

interface SecuritySettingsProps {
  autoLockTimeout: number;
  onAutoLockChange: (minutes: number) => void;
  requirePasswordForSensitiveActions: boolean;
  onRequirePasswordForSensitiveActionsChange: (value: boolean) => void;
  onBack: () => void;
}

const TIMEOUT_OPTIONS = [
  { label: '1 minute', value: 1 },
  { label: '5 minutes', value: 5 },
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: 'Never', value: 0 },
];

// ── Change Password ──────────────────────────────────────────────────────────

function ChangePasswordView({ onDone }: { onDone: () => void }) {
  const [form, setForm] = React.useState({ current: '', next: '', confirm: '' });
  const [showNext, setShowNext] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState(false);

  function handleSubmit(e: React.FormEvent) {
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
    return (
      <div className="flex flex-col items-center gap-4 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <p className="font-semibold text-base">Password Updated</p>
          <p className="text-sm text-muted-foreground mt-1">
            Your wallet password has been changed successfully.
          </p>
        </div>
        <Button className="w-full mt-2" onClick={onDone}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Current Password
        </label>
        <Input
          type="password"
          placeholder="Enter current password"
          value={form.current}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setForm((formState) => ({ ...formState, current: event.target.value }))
          }
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          New Password
        </label>
        <div className="relative">
          <Input
            type={showNext ? 'text' : 'password'}
            placeholder="Min. 8 characters"
            value={form.next}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setForm((formState) => ({ ...formState, next: event.target.value }))
            }
            className="pr-10"
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowNext((s) => !s)}
          >
            {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Confirm New Password
        </label>
        <Input
          type="password"
          placeholder="Repeat new password"
          value={form.confirm}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setForm((formState) => ({ ...formState, confirm: event.target.value }))
          }
        />
      </div>
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
      <Button type="submit" className="w-full mt-1">
        Update Password
      </Button>
    </form>
  );
}

// ── Auto-lock ────────────────────────────────────────────────────────────────

function AutoLockView({
  value,
  onChange,
  onDone,
}: {
  value: number;
  onChange: (v: number) => void;
  onDone: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 p-4">
      <p className="text-xs text-muted-foreground mb-1">
        Wallet will lock automatically after the selected period of inactivity.
      </p>
      <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
        {TIMEOUT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className="flex w-full items-center justify-between px-4 py-3.5 text-sm hover:bg-accent/50 transition-colors"
            onClick={() => {
              onChange(opt.value);
              onDone();
            }}
          >
            <span className="font-medium">{opt.label}</span>
            {value === opt.value && (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                <Check className="h-3 w-3 text-white" aria-label="active" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Export warning wrapper ───────────────────────────────────────────────────

function ExportWarningView({
  warningText,
  requirePassword,
  onConfirm,
  onCancel,
}: {
  title: string;
  warningText: string;
  requirePassword: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = React.useState('');
  const [confirmed, setConfirmed] = React.useState(false);
  const [secret] = React.useState('SCZANGBA5WGGU4NBKMJQJZ7WHKDXGZNZEBCV3LTXNZXR4XMXAMPLE');
  const [show, setShow] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState('');

  function handleReveal(e: React.FormEvent) {
    e.preventDefault();
    if (requirePassword && !password) {
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
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-xs text-destructive leading-relaxed">
            Never share this with anyone. Anyone with this can steal all your funds.
          </p>
        </div>
        <div className="relative rounded-xl border border-border bg-muted p-4 font-mono text-xs break-all leading-relaxed">
          {show ? secret : '•'.repeat(secret.length)}
          <div className="flex gap-2 mt-3 justify-end">
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="flex items-center gap-1.5 rounded-lg bg-background border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
            >
              {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {show ? 'Hide' : 'Reveal'}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg bg-background border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
        <Button variant="outline" className="w-full" onClick={onConfirm}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleReveal} className="flex flex-col gap-4 p-4">
      <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <p className="font-semibold text-destructive text-sm">Sensitive Information</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{warningText}</p>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {requirePassword ? 'Confirm Password' : 'Password Check (Disabled)'}
        </label>
        <Input
          type="password"
          placeholder={
            requirePassword
              ? 'Enter password to continue'
              : 'Sensitive export password check disabled'
          }
          value={password}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
          disabled={!requirePassword}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2 mt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="destructive" className="flex-1">
          Reveal
        </Button>
      </div>
    </form>
  );
}

// ── SecuritySettings root ────────────────────────────────────────────────────

export function SecuritySettings({
  autoLockTimeout,
  onAutoLockChange,
  requirePasswordForSensitiveActions,
  onRequirePasswordForSensitiveActionsChange,
  onBack,
}: SecuritySettingsProps) {
  const [view, setView] = React.useState<SecurityView>('menu');

  const titles: Record<SecurityView, string> = {
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

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ScreenHeader title={titles[view]} onBack={handleBack} />

      {view === 'menu' && (
        <SecurityMenu
          autoLockTimeout={autoLockTimeout}
          onNavigate={setView}
          requirePasswordForSensitiveActions={requirePasswordForSensitiveActions}
          onRequirePasswordForSensitiveActionsChange={onRequirePasswordForSensitiveActionsChange}
        />
      )}
      {view === 'change-password' && <ChangePasswordView onDone={() => setView('menu')} />}
      {view === 'auto-lock' && (
        <AutoLockView
          value={autoLockTimeout}
          onChange={onAutoLockChange}
          onDone={() => setView('menu')}
        />
      )}
      {view === 'export-key' && (
        <ExportWarningView
          title="Export Private Key"
          warningText="Your private key grants full control of your account. Anyone with it can steal your funds immediately."
          requirePassword={requirePasswordForSensitiveActions}
          onConfirm={() => setView('menu')}
          onCancel={() => setView('menu')}
        />
      )}
      {view === 'export-mnemonic' && (
        <ExportWarningView
          title="Export Recovery Phrase"
          warningText="Your recovery phrase can restore your entire wallet. Keep it offline, never share it with anyone."
          requirePassword={requirePasswordForSensitiveActions}
          onConfirm={() => setView('menu')}
          onCancel={() => setView('menu')}
        />
      )}
    </div>
  );
}

function SecurityMenu({
  autoLockTimeout,
  onNavigate,
  requirePasswordForSensitiveActions,
  onRequirePasswordForSensitiveActionsChange,
}: {
  autoLockTimeout: number;
  onNavigate: (v: SecurityView) => void;
  requirePasswordForSensitiveActions: boolean;
  onRequirePasswordForSensitiveActionsChange: (value: boolean) => void;
}) {
  const timeoutLabel = TIMEOUT_OPTIONS.find((o) => o.value === autoLockTimeout)?.label ?? 'Custom';

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
        <MenuItem
          label="Change Password"
          description="Update your wallet password"
          onClick={() => onNavigate('change-password')}
        />
        <MenuItem
          label="Auto-lock Timeout"
          description="Lock after inactivity"
          value={timeoutLabel}
          onClick={() => onNavigate('auto-lock')}
        />
        <MenuItem
          label="Require password for exports"
          description="Gate key/mnemonic reveal behind password"
          value={requirePasswordForSensitiveActions ? 'Enabled' : 'Disabled'}
          onClick={() =>
            onRequirePasswordForSensitiveActionsChange(!requirePasswordForSensitiveActions)
          }
        />
      </div>
      <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Danger Zone
      </p>
      <div className="rounded-xl border border-destructive/30 bg-card overflow-hidden divide-y divide-destructive/10">
        <MenuItem
          label="Export Private Key"
          description="Reveal your raw private key"
          onClick={() => onNavigate('export-key')}
          danger
        />
        <MenuItem
          label="Export Recovery Phrase"
          description="Reveal your 12-word mnemonic"
          onClick={() => onNavigate('export-mnemonic')}
          danger
        />
      </div>
    </div>
  );
}

function MenuItem({
  label,
  description,
  value,
  onClick,
  danger = false,
}: {
  label: string;
  description?: string;
  value?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      className={`flex w-full items-center justify-between px-4 py-3.5 text-sm hover:bg-accent/50 transition-colors ${danger ? 'text-destructive' : ''}`}
      onClick={onClick}
    >
      <span className="text-left">
        <span className="block font-medium">{label}</span>
        {description && (
          <span className="block text-xs text-muted-foreground mt-0.5">{description}</span>
        )}
      </span>
      {value ? (
        <span className="text-xs text-muted-foreground ml-2 shrink-0">{value}</span>
      ) : (
        <span className="text-muted-foreground/40 ml-2">›</span>
      )}
    </button>
  );
}
