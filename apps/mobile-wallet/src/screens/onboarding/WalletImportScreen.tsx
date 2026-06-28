import React from 'react';
import { validateMnemonic } from '@ancore/crypto';

type Props = {
  onBack?: () => void;
  onCancel?: () => void;
  onContinue?: (mnemonic: string) => void;
};

const noop = () => {};

export function WalletImportScreen({ onBack = noop, onCancel = noop, onContinue = noop }: Props) {
  const [mnemonic, setMnemonic] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const words = mnemonic.trim().split(/\s+/).filter(Boolean);
  const hasEnoughWords = words.length >= 12;

  const handleContinue = () => {
    const normalized = mnemonic.trim().replace(/\s+/g, ' ');

    if (validateMnemonic(normalized)) {
      setError(null);
      onContinue(normalized);
    } else {
      setError(
        'Invalid recovery phrase. Please check each word is spelled correctly and you have exactly 12 words.'
      );
    }
  };

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
          onChange={(event) => {
            setMnemonic(event.target.value);
            setError(null);
          }}
          placeholder="Enter your 12-word recovery phrase"
          value={mnemonic}
        />
      </label>

      {error && (
        <p aria-live="polite" className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} type="button">
          Back
        </button>
        <button onClick={onCancel} type="button">
          Cancel
        </button>
        <button disabled={!hasEnoughWords} onClick={handleContinue} type="button">
          Continue
        </button>
      </div>
    </section>
  );
}
