type Props = {
  mnemonic: string;
  onBack?: () => void;
  onCancel?: () => void;
  onContinue?: () => void;
};

const noop = () => {};

export function MnemonicDisplayScreen({
  mnemonic,
  onBack = noop,
  onCancel = noop,
  onContinue = noop,
}: Props) {
  const words = mnemonic.split(' ');

  return (
    <section aria-label="Recovery phrase" className="space-y-4">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-slate-500">Create</p>
        <h1 className="text-2xl font-semibold text-slate-950">Your recovery phrase</h1>
        <p className="text-sm text-slate-600">
          Write down these 12 words in order. Never share them with anyone.
        </p>
      </header>

      <div aria-label="Recovery phrase words" className="grid grid-cols-2 gap-2" role="list">
        {words.map((word, index) => (
          <div
            key={index}
            className="flex items-center gap-2 text-sm text-slate-700"
            role="listitem"
          >
            <span className="w-6 text-right text-slate-400 tabular-nums">{index + 1}.</span>
            <span>{word}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} type="button">
          Back
        </button>
        <button onClick={onCancel} type="button">
          Cancel
        </button>
        <button onClick={onContinue} type="button">
          I wrote it down
        </button>
      </div>
    </section>
  );
}
