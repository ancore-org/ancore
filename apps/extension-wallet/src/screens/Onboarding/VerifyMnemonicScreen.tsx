import * as React from 'react';
import { AlertCircle, Check, ChevronRight, RotateCcw } from 'lucide-react';

/**
 * VerifyMnemonicScreen props
 */
export interface VerifyMnemonicScreenProps {
  mnemonic: string;
  onSuccess: () => void;
  onBack: () => void;
}

interface WordInput {
  index: number;
  word: string;
  userInput: string;
  isCorrect: boolean | null;
}

/**
 * Selects random indices for verification
 * We select 3 words to verify: positions 2, 5, 9 (0-indexed: 1, 4, 8)
 */
function selectVerificationIndices(): number[] {
  // In production, use crypto.getRandomValues for secure random selection
  // For simplicity, we verify words at positions 3, 7, 11 (1-indexed)
  return [2, 6, 10];
}

/**
 * VerifyMnemonicScreen - Verifies user has saved their recovery phrase
 *
 * Asks user to enter specific words from their mnemonic to confirm
 * they have properly backed up their recovery phrase.
 */
export function VerifyMnemonicScreen({ mnemonic, onSuccess, onBack }: VerifyMnemonicScreenProps) {
  const words = React.useMemo(() => {
    return mnemonic.split(' ');
  }, [mnemonic]);

  const verificationIndices = React.useMemo(() => {
    return selectVerificationIndices();
  }, []);

  const [inputs, setInputs] = React.useState<WordInput[]>(() => {
    return verificationIndices.map((index) => ({
      index,
      word: words[index],
      userInput: '',
      isCorrect: null,
    }));
  });

  const [error, setError] = React.useState<string | null>(null);
  const [showAllWords, setShowAllWords] = React.useState(false);

  const handleInputChange = React.useCallback((index: number, value: string) => {
    setInputs((prev) =>
      prev.map((input, i) =>
        i === index ? { ...input, userInput: value.toLowerCase().trim() } : input
      )
    );
    setError(null);
  }, []);

  const verifyInputs = React.useCallback(() => {
    let allCorrect = true;

    const updatedInputs = inputs.map((input) => {
      const isCorrect = input.userInput === input.word.toLowerCase();
      if (!isCorrect) allCorrect = false;
      return { ...input, isCorrect };
    });

    setInputs(updatedInputs);

    if (allCorrect) {
      onSuccess();
    } else {
      setError('Some words are incorrect. Please check and try again.');
    }
  }, [inputs, onSuccess]);

  const retryVerification = React.useCallback(() => {
    setInputs((prev) =>
      prev.map((input) => ({
        ...input,
        userInput: '',
        isCorrect: null,
      }))
    );
    setError(null);
  }, []);

  const allInputsFilled = inputs.every((input) => input.userInput.length > 0);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 overflow-y-auto">
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-foreground mb-2">Verify Your Backup</h1>
          <p className="text-sm text-muted-foreground">
            Enter the following words from your recovery phrase to confirm you've saved them
            correctly.
          </p>
        </div>

        {/* Verification Section */}
        <div className="space-y-4 mb-6">
          {inputs.map((input, inputIndex) => (
            <div key={inputIndex} className="space-y-2">
              <label className="text-sm font-medium text-foreground">Word #{input.index + 1}</label>
              <div className="relative">
                <input
                  type="text"
                  value={input.userInput}
                  onChange={(e) => handleInputChange(inputIndex, e.target.value)}
                  placeholder={`Enter word ${input.index + 1}`}
                  className={`w-full px-4 py-3 bg-card border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all ${
                    input.isCorrect === true
                      ? 'border-green-500 bg-green-50'
                      : input.isCorrect === false
                        ? 'border-red-500 bg-red-50'
                        : 'border-border'
                  }`}
                  autoComplete="off"
                  autoCapitalize="off"
                />
                {input.isCorrect === true && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Check className="w-5 h-5 text-green-600" />
                  </div>
                )}
                {input.isCorrect === false && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  </div>
                )}
              </div>
              {input.isCorrect === false && (
                <p className="text-xs text-red-600">
                  Incorrect. The correct word is "{input.word}"
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Toggle to show all words */}
        <button
          onClick={() => setShowAllWords(!showAllWords)}
          className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAllWords ? 'Hide' : 'Show'} my recovery phrase
        </button>

        {showAllWords && (
          <div className="bg-card rounded-xl border border-border/50 p-4 mb-6">
            <div className="grid grid-cols-3 gap-2">
              {words.map((word, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                    verificationIndices.includes(index)
                      ? 'bg-primary/10 border border-primary/30'
                      : 'bg-muted/50'
                  }`}
                >
                  <span className="text-[10px] text-muted-foreground font-medium w-4">
                    {index + 1}.
                  </span>
                  <span className="text-sm font-medium text-foreground">{word}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Help Text */}
        <div className="bg-muted/30 rounded-xl p-4 mb-6">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Tip:</strong> If you didn't save your recovery
            phrase, go back and write it down before continuing. Without it, you won't be able to
            recover your wallet.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-6 pb-8 bg-background border-t border-border/50">
        <div className="flex gap-3">
          <button
            onClick={retryVerification}
            className="flex-1 py-4 px-6 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Clear
          </button>
          <button
            onClick={verifyInputs}
            disabled={!allInputsFilled}
            className="flex-[2] py-4 px-6 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-primary/25 disabled:shadow-none active:scale-[0.98]"
          >
            Verify & Continue
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-center text-muted-foreground mt-3">
          {inputs.length} words to verify
        </p>
      </div>
    </div>
  );
}
