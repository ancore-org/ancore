import * as React from 'react';
import { AlertCircle, ChevronRight, Check } from 'lucide-react';
import { getEnglishWordlist } from '@ancore/crypto';

export interface VerifyMnemonicScreenProps {
  mnemonic: string;
  onSuccess: () => void;
  onBack: () => void;
}

interface VerificationChallenge {
  index: number;
  word: string;
  options: string[];
  selectedOption: string | null;
  isCorrect: boolean | null;
}

function selectVerificationIndices(): number[] {
  // Select 3 random non-consecutive indices between 0 and 11
  const indices: number[] = [];
  while (indices.length < 3) {
    const nextIdx = Math.floor(Math.random() * 12);
    // Check if it's not already in the array, and no consecutive indices
    if (!indices.includes(nextIdx) && !indices.some((i) => Math.abs(i - nextIdx) <= 1)) {
      indices.push(nextIdx);
    }
  }
  return indices.sort((a, b) => a - b);
}

function generateOptions(correctWord: string, allWords: string[]): string[] {
  const options = new Set<string>();
  options.add(correctWord);

  while (options.size < 4) {
    const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
    if (randomWord) {
      options.add(randomWord);
    }
  }

  return Array.from(options).sort(() => Math.random() - 0.5);
}

export function VerifyMnemonicScreen({ mnemonic, onSuccess, onBack }: VerifyMnemonicScreenProps) {
  const words = React.useMemo(() => mnemonic.split(' '), [mnemonic]);
  const wordlist = React.useMemo(() => getEnglishWordlist(), []);

  const [challenges, setChallenges] = React.useState<VerificationChallenge[]>(() => {
    const indices = selectVerificationIndices();
    return indices.map((index) => ({
      index,
      word: words[index],
      options: generateOptions(words[index], wordlist),
      selectedOption: null,
      isCorrect: null,
    }));
  });

  const [error, setError] = React.useState<string | null>(null);

  const handleSelect = React.useCallback((challengeIndex: number, option: string) => {
    setChallenges((prev) =>
      prev.map((c, i) =>
        i === challengeIndex ? { ...c, selectedOption: option, isCorrect: option === c.word } : c
      )
    );
    setError(null);
  }, []);

  const verifyAnswers = React.useCallback(() => {
    const allCorrect = challenges.every((c) => c.isCorrect);
    if (allCorrect) {
      onSuccess();
    } else {
      setError('Some words are incorrect. Please try again.');
    }
  }, [challenges, onSuccess]);

  const allAnswered = challenges.every((c) => c.selectedOption !== null);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="px-6 pt-6 pb-4">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back
        </button>
      </div>

      <div className="flex-1 px-6 overflow-y-auto">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-foreground mb-2">Verify Your Backup</h1>
          <p className="text-sm text-muted-foreground">
            Select the correct words to confirm you've saved your recovery phrase.
          </p>
        </div>

        <div className="space-y-6 mb-6">
          {challenges.map((challenge, idx) => (
            <div key={idx} className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                Word #{challenge.index + 1}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {challenge.options.map((option) => {
                  const isSelected = challenge.selectedOption === option;
                  let btnClass = 'border-border bg-card text-foreground hover:border-primary';
                  if (isSelected) {
                    if (challenge.isCorrect === false && error) {
                      btnClass = 'border-red-500 bg-red-50 text-red-700';
                    } else if (challenge.isCorrect === false) {
                      btnClass = 'border-primary bg-primary/10 text-primary';
                    } else {
                      btnClass = 'border-primary bg-primary/10 text-primary';
                    }
                  } else if (
                    challenge.selectedOption !== null &&
                    option === challenge.word &&
                    challenge.isCorrect === false &&
                    error
                  ) {
                    // highlight correct one in green if they failed
                    btnClass = 'border-green-500 bg-green-50 text-green-700';
                  }

                  return (
                    <button
                      key={option}
                      onClick={() => handleSelect(idx, option)}
                      className={`px-4 py-3 rounded-xl border transition-all text-sm font-medium flex items-center justify-between ${btnClass}`}
                    >
                      {option}
                      {isSelected && challenge.isCorrect && error && (
                        <Check className="h-4 w-4 text-green-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      <div className="px-6 py-6 pb-8 bg-background border-t border-border/50">
        <button
          onClick={verifyAnswers}
          disabled={!allAnswered}
          className="w-full py-4 px-6 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-primary/25 disabled:shadow-none active:scale-[0.98]"
        >
          Verify & Continue
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
