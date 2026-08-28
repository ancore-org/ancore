import React from 'react';

type Props = {
  onBack?: () => void;
  onCancel?: () => void;
  onContinue?: () => void;
};

const noop = () => {};

export function WalletCreateScreen({ onBack = noop, onCancel = noop, onContinue = noop }: Props) {
  const [walletName, setWalletName] = React.useState('');

  const canContinue = walletName.trim().length > 0;

  return (
    <section aria-label="Create wallet" className="space-y-4">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-slate-500">Create</p>
        <h1 className="text-2xl font-semibold text-slate-950">Create a new wallet</h1>
        <p className="text-sm text-slate-600">
          Enter a name for your wallet. You will be guided through creating a recovery phrase.
        </p>
      </header>

      <label className="block space-y-2 text-sm text-slate-700">
        <span>Wallet name</span>
        <input
          aria-label="Wallet name"
          onChange={(event) => setWalletName(event.target.value)}
          placeholder="My wallet"
          value={walletName}
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
