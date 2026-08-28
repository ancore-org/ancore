import { useCallback, useMemo, useState } from 'react';

type Props = {
  mnemonic: string;
  onBack?: () => void;
  onCancel?: () => void;
  onComplete?: () => void;
};

const noop = () => {};

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function pickRandomPositions(count: number, total: number): number[] {
  const indices = Array.from({ length: total }, (_, i) => i);
  return shuffle(indices)
    .slice(0, count)
    .sort((a, b) => a - b);
}

function generateWordBank(mnemonic: string, position: number): string[] {
  const words = mnemonic.split(' ');
  const correctWord = words[position];
  const otherWords = words.filter((_, i) => i !== position);
  const uniqueOthers = [...new Set(otherWords)];
  const distractors = shuffle(uniqueOthers).slice(0, 3);
  return shuffle([correctWord, ...distractors]);
}

export function VerifyMnemonicScreen({
  mnemonic,
  onBack = noop,
  onCancel = noop,
  onComplete = noop,
}: Props) {
  const words = useMemo(() => mnemonic.split(' '), [mnemonic]);

  const positions = useMemo(() => pickRandomPositions(3, 12), []);

  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState(false);

  const position = positions[currentStep];
  const correctWord = words[position];

  const wordBank = useMemo(() => generateWordBank(mnemonic, position), [mnemonic, position]);

  const handleWordSelect = useCallback(
    (word: string) => {
      if (word === correctWord) {
        if (currentStep === positions.length - 1) {
          onComplete();
        } else {
          setCurrentStep((step) => step + 1);
          setError(false);
        }
      } else {
        setError(true);
      }
    },
    [correctWord, currentStep, positions.length, onComplete]
  );

  return (
    <section aria-label="Verify recovery phrase" className="space-y-4">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-slate-500">Create</p>
        <h1 className="text-2xl font-semibold text-slate-950">Verify your recovery phrase</h1>
        <p className="text-sm text-slate-600">
          Select word #{position + 1} to confirm you wrote it down correctly.
        </p>
      </header>

      {error && (
        <p aria-live="polite" className="text-sm text-red-600" role="alert">
          Incorrect word. Please try again.
        </p>
      )}

      <div aria-label="Word options" className="grid grid-cols-2 gap-2" role="group">
        {wordBank.map((word) => (
          <button key={word} onClick={() => handleWordSelect(word)} type="button">
            {word}
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} type="button">
          Back
        </button>
        <button onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </section>
  );
}
