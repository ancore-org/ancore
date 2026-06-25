import React from 'react';

type Props = {
  onBack?: () => void;
  onCancel?: () => void;
  onContinue?: () => void;
};

const noop = () => {};

export function WalletRecoverScreen({ onBack = noop, onCancel = noop, onContinue = noop }: Props) {
  const [backupPhrase, setBackupPhrase] = React.useState('');
  const [recoveryCode, setRecoveryCode] = React.useState('');

  const canContinue =
    backupPhrase.trim().split(/\s+/).filter(Boolean).length >= 12 && recoveryCode.trim().length > 0;

  return (
    <section aria-label="Recover wallet" className="space-y-4">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-slate-500">Recover</p>
        <h1 className="text-2xl font-semibold text-slate-950">Recover from backup</h1>
        <p className="text-sm text-slate-600">
          Use a backup phrase and recovery code to restore access.
        </p>
      </header>

      <label className="block space-y-2 text-sm text-slate-700">
        <span>Backup phrase</span>
        <textarea
          aria-label="Backup phrase"
          onChange={(event) => setBackupPhrase(event.target.value)}
          placeholder="Enter your backup phrase"
          value={backupPhrase}
        />
      </label>

      <label className="block space-y-2 text-sm text-slate-700">
        <span>Recovery code</span>
        <input
          aria-label="Recovery code"
          onChange={(event) => setRecoveryCode(event.target.value)}
          placeholder="Enter your recovery code"
          value={recoveryCode}
        />
      </label>

      <div className="flex gap-3">
        <button onClick={onBack} type="button">
          Back
        </button>
        <button onClick={onCancel} type="button">
          Cancel
        </button>
        <button disabled={!canContinue} onClick={onContinue} type="button">
          Continue
        </button>
      </div>
    </section>
  );
}
