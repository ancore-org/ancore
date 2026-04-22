import * as React from 'react';
import { AlertTriangle, Copy, Check, ChevronRight, Eye, EyeOff } from 'lucide-react';

/**
 * MnemonicScreen props
 */
export interface MnemonicScreenProps {
  mnemonic: string;
  onNext: () => void;
  onBack: () => void;
}

/**
 * MnemonicScreen - Displays the 12-word recovery phrase
 *
 * Shows the generated mnemonic with security warnings and
 * allows users to copy it for backup purposes.
 */
export function MnemonicScreen({ mnemonic, onNext, onBack }: MnemonicScreenProps) {
  const [copied, setCopied] = React.useState(false);
  const [showWarning, setShowWarning] = React.useState(true);

  const words = React.useMemo(() => {
    return mnemonic.split(' ');
  }, [mnemonic]);

  const copyToClipboard = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(mnemonic);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [mnemonic]);

  const handleNext = React.useCallback(() => {
    onNext();
  }, [onNext]);

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
        {/* Warning Banner */}
        {showWarning && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-amber-900 mb-1">
                  Never share your recovery phrase
                </h4>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Anyone with these words can steal your funds. Ancore will NEVER ask for your
                  recovery phrase. Store it offline in a safe place.
                </p>
              </div>
              <button
                onClick={() => setShowWarning(false)}
                className="text-amber-600 hover:text-amber-800 p-1"
              >
                <EyeOff className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-foreground mb-2">Your Recovery Phrase</h1>
          <p className="text-sm text-muted-foreground">
            Write down these 12 words in order. This is the ONLY way to recover your wallet.
          </p>
        </div>

        {/* Mnemonic Grid */}
        <div className="bg-card rounded-xl border border-border/50 p-4 mb-6">
          <div className="grid grid-cols-3 gap-2">
            {words.map((word, index) => (
              <div key={index} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <span className="text-[10px] text-muted-foreground font-medium w-4">
                  {index + 1}.
                </span>
                <span className="text-sm font-medium text-foreground">{word}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={copyToClipboard}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-xl transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-600">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span className="text-sm font-medium">Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Security Tips */}
        <div className="bg-muted/30 rounded-xl p-4 mb-6">
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Security Tips
          </h4>
          <ul className="space-y-2">
            <li className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="text-green-600 mt-0.5">✓</span>
              Write it on paper and store in a fireproof safe
            </li>
            <li className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="text-green-600 mt-0.5">✓</span>
              Never take a screenshot or paste it in notes
            </li>
            <li className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="text-green-600 mt-0.5">✓</span>
              Consider using a hardware wallet for extra security
            </li>
            <li className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="text-red-600 mt-0.5">✗</span>
              Never share with anyone, including Ancore support
            </li>
          </ul>
        </div>

        {/* Acknowledgment Checkbox */}
        <label className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl cursor-pointer mb-6">
          <input
            type="checkbox"
            className="mt-1 w-4 h-4 rounded border-primary/30 text-primary focus:ring-primary"
          />
          <span className="text-xs text-foreground leading-relaxed">
            I understand that if I lose my recovery phrase, I will lose access to my wallet and all
            funds permanently.
          </span>
        </label>
      </div>

      {/* Footer */}
      <div className="px-6 py-6 pb-8 bg-background border-t border-border/50">
        <button
          onClick={handleNext}
          className="w-full py-4 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-primary/25 active:scale-[0.98]"
        >
          I've Saved My Recovery Phrase
          <ChevronRight className="w-5 h-5" />
        </button>

        <p className="text-xs text-center text-muted-foreground mt-3">
          You'll verify your backup on the next screen
        </p>
      </div>
    </div>
  );
}
