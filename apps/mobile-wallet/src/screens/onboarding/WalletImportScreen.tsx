import React from 'react';

type Props = {
  onBack?: () => void;
  onCancel?: () => void;
  onContinue?: () => void;
};

const noop = () => {};

export function WalletImportScreen({ onBack = noop, onCancel = noop, onContinue = noop }: Props) {
  const [mnemonic, setMnemonic] = React.useState('');

  const canContinue = mnemonic.trim().split(/\s+/).filter(Boolean).length >= 12;

  return (
    <section aria-label="Import wallet" className="space-y-4">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-slate-500">Import</p>
        <h1 className="text-2xl font-semibold text-slate-950">Import an existing wallet</h1>
        <p className="text-sm text-slate-600">Paste a recovery phrase to continue.</p>
      </header>

      <label className="block space-y-2 text-sm text-slate-700">
        <span>Recovery phrase</span>
        <textarea
          aria-label="Recovery phrase"
          onChange={(event) => setMnemonic(event.target.value)}
          placeholder="Enter your 12-word recovery phrase"
          value={mnemonic}
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
