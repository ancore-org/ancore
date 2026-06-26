import React from 'react';
import {
  getEnglishBip39Wordlist,
  MnemonicValidationError,
  validateMnemonicStrength,
} from '@ancore/crypto';
import type { DiscoveredHdAccount } from '@ancore/core-sdk';

export type DiscoverAccountsFn = (
  mnemonic: string,
  options?: {
    onProgress?: (progress: { accountIndex: number; scanned: number; total: number }) => void;
    signal?: AbortSignal;
  }
) => Promise<DiscoveredHdAccount[]>;

type InputMode = 'paste' | 'words';
type Step = 'input' | 'scanning' | 'select';

type Props = {
  onBack?: () => void;
  onCancel?: () => void;
  onContinue?: (mnemonic: string, accountIndex: number) => void;
  discoverAccounts?: DiscoverAccountsFn;
};

const noop = () => {};

const WORD_COUNT_OPTIONS = [12, 24] as const;

function getBip39Wordlist(): readonly string[] {
  return getEnglishBip39Wordlist();
}

function normalizeMnemonic(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function formatPublicKey(publicKey: string): string {
  if (publicKey.length <= 12) {
    return publicKey;
  }

  return `${publicKey.slice(0, 4)}…${publicKey.slice(-4)}`;
}

function createEmptyWordFields(count: number): string[] {
  return Array.from({ length: count }, () => '');
}

function wordsFromFields(fields: string[]): string {
  return fields
    .map((word) => word.trim())
    .filter(Boolean)
    .join(' ');
}

function isCompleteWordCount(count: number): boolean {
  return count === 12 || count === 24;
}

function mnemonicErrorMessage(error: unknown): string {
  if (error instanceof MnemonicValidationError) {
    return error.message;
  }

  return 'Invalid recovery phrase. Please check each word is spelled correctly and you have exactly 12 or 24 words.';
}

export function WalletImportScreen({
  onBack = noop,
  onCancel = noop,
  onContinue = noop,
  discoverAccounts,
}: Props) {
  const [step, setStep] = React.useState<Step>('input');
  const [inputMode, setInputMode] = React.useState<InputMode>('paste');
  const [wordCount, setWordCount] = React.useState<(typeof WORD_COUNT_OPTIONS)[number]>(12);
  const [pasteValue, setPasteValue] = React.useState('');
  const [wordFields, setWordFields] = React.useState<string[]>(() => createEmptyWordFields(12));
  const [error, setError] = React.useState<string | null>(null);
  const [scanProgress, setScanProgress] = React.useState({ scanned: 0, total: 6 });
  const [discoveredAccounts, setDiscoveredAccounts] = React.useState<DiscoveredHdAccount[]>([]);
  const [selectedAccountIndex, setSelectedAccountIndex] = React.useState(0);
  const [validatedMnemonic, setValidatedMnemonic] = React.useState<string | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const mnemonic =
    inputMode === 'paste'
      ? normalizeMnemonic(pasteValue)
      : normalizeMnemonic(wordsFromFields(wordFields));

  const wordTotal =
    inputMode === 'paste'
      ? mnemonic.split(' ').filter(Boolean).length
      : wordFields.filter(Boolean).length;

  const hasCompletePhrase = isCompleteWordCount(wordTotal);

  const resetDiscoveryState = React.useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setStep('input');
    setScanProgress({ scanned: 0, total: 6 });
    setDiscoveredAccounts([]);
    setValidatedMnemonic(null);
  }, []);

  const handleWordCountChange = (nextCount: (typeof WORD_COUNT_OPTIONS)[number]) => {
    setWordCount(nextCount);
    setWordFields(createEmptyWordFields(nextCount));
    setError(null);
  };

  const handleInputModeChange = (nextMode: InputMode) => {
    setInputMode(nextMode);
    setError(null);

    if (nextMode === 'words') {
      setWordFields(createEmptyWordFields(wordCount));
    }
  };

  const validateCurrentMnemonic = (): string | null => {
    try {
      validateMnemonicStrength(mnemonic);
      return normalizeMnemonic(mnemonic);
    } catch (validationError) {
      setError(mnemonicErrorMessage(validationError));
      return null;
    }
  };

  const runDiscovery = async (normalizedMnemonic: string) => {
    if (!discoverAccounts) {
      onContinue(normalizedMnemonic, 0);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setValidatedMnemonic(normalizedMnemonic);
    setStep('scanning');
    setError(null);
    setScanProgress({ scanned: 0, total: 6 });

    try {
      const accounts = await discoverAccounts(normalizedMnemonic, {
        signal: controller.signal,
        onProgress: ({ scanned, total }) => {
          setScanProgress({ scanned, total });
        },
      });

      setDiscoveredAccounts(accounts);
      setSelectedAccountIndex(accounts[0]?.accountIndex ?? 0);
      setStep('select');
    } catch (discoveryError) {
      if (discoveryError instanceof DOMException && discoveryError.name === 'AbortError') {
        resetDiscoveryState();
        return;
      }

      setStep('input');
      setError(
        discoveryError instanceof Error
          ? discoveryError.message
          : 'Unable to scan accounts. Please try again.'
      );
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleContinue = async () => {
    const normalizedMnemonic = validateCurrentMnemonic();
    if (!normalizedMnemonic) {
      return;
    }

    setError(null);
    await runDiscovery(normalizedMnemonic);
  };

  const handleCancelScan = () => {
    abortControllerRef.current?.abort();
  };

  const handleConfirmAccount = () => {
    if (!validatedMnemonic) {
      return;
    }

    onContinue(validatedMnemonic, selectedAccountIndex);
  };

  if (step === 'scanning') {
    return (
      <section aria-label="Scanning accounts" className="space-y-4">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-slate-500">Import</p>
          <h1 className="text-2xl font-semibold text-slate-950">Scanning for accounts</h1>
          <p className="text-sm text-slate-600">
            Checking derived accounts {scanProgress.scanned} of {scanProgress.total} on the network.
          </p>
        </header>

        <div aria-live="polite" className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full bg-slate-900 transition-all"
            style={{
              width: `${scanProgress.total === 0 ? 0 : (scanProgress.scanned / scanProgress.total) * 100}%`,
            }}
          />
        </div>

        <div className="flex gap-3">
          <button onClick={handleCancelScan} type="button">
            Cancel scan
          </button>
        </div>
      </section>
    );
  }

  if (step === 'select') {
    const hasFundedAccounts = discoveredAccounts.length > 0;

    return (
      <section aria-label="Select imported account" className="space-y-4">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-slate-500">Import</p>
          <h1 className="text-2xl font-semibold text-slate-950">Choose an account</h1>
          <p className="text-sm text-slate-600">
            {hasFundedAccounts
              ? 'Select the funded account you want to restore.'
              : 'No funded accounts were found. You can still restore the first derived account.'}
          </p>
        </header>

        <fieldset className="space-y-3">
          <legend className="sr-only">Discovered accounts</legend>
          {hasFundedAccounts ? (
            discoveredAccounts.map((account) => (
              <label
                className="flex items-start gap-3 text-sm text-slate-700"
                key={account.publicKey}
              >
                <input
                  checked={selectedAccountIndex === account.accountIndex}
                  name="discovered-account"
                  onChange={() => setSelectedAccountIndex(account.accountIndex)}
                  type="radio"
                  value={account.accountIndex}
                />
                <span>
                  <span className="block font-medium">Account {account.accountIndex + 1}</span>
                  <span className="block text-slate-500">{formatPublicKey(account.publicKey)}</span>
                  <span className="block text-slate-600">{account.balance} XLM</span>
                </span>
              </label>
            ))
          ) : (
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input checked name="discovered-account" readOnly type="radio" value={0} />
              <span>
                <span className="block font-medium">Account 1</span>
                <span className="block text-slate-500">m/44&apos;/148&apos;/0&apos;</span>
              </span>
            </label>
          )}
        </fieldset>

        <div className="flex gap-3">
          <button onClick={resetDiscoveryState} type="button">
            Back
          </button>
          <button onClick={onCancel} type="button">
            Cancel
          </button>
          <button onClick={handleConfirmAccount} type="button">
            Continue
          </button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Import wallet" className="space-y-4">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-slate-500">Import</p>
        <h1 className="text-2xl font-semibold text-slate-950">Import an existing wallet</h1>
        <p className="text-sm text-slate-600">
          Enter a 12- or 24-word recovery phrase to continue.
        </p>
      </header>

      <div className="flex gap-2">
        <button
          aria-pressed={inputMode === 'paste'}
          onClick={() => handleInputModeChange('paste')}
          type="button"
        >
          Paste phrase
        </button>
        <button
          aria-pressed={inputMode === 'words'}
          onClick={() => handleInputModeChange('words')}
          type="button"
        >
          Word by word
        </button>
      </div>

      {inputMode === 'paste' ? (
        <label className="block space-y-2 text-sm text-slate-700">
          <span>Recovery phrase</span>
          <textarea
            aria-label="Recovery phrase"
            onChange={(event) => {
              setPasteValue(event.target.value);
              setError(null);
            }}
            placeholder="Enter your 12- or 24-word recovery phrase"
            value={pasteValue}
          />
        </label>
      ) : (
        <div className="space-y-3">
          <fieldset className="space-y-2">
            <legend className="text-sm text-slate-700">Phrase length</legend>
            <div className="flex gap-3">
              {WORD_COUNT_OPTIONS.map((option) => (
                <label className="flex items-center gap-2 text-sm text-slate-700" key={option}>
                  <input
                    checked={wordCount === option}
                    name="word-count"
                    onChange={() => handleWordCountChange(option)}
                    type="radio"
                    value={option}
                  />
                  {option} words
                </label>
              ))}
            </div>
          </fieldset>

          <datalist id="bip39-wordlist">
            {getBip39Wordlist().map((word: string) => (
              <option key={word} value={word} />
            ))}
          </datalist>

          <div className="grid grid-cols-3 gap-2">
            {wordFields.map((word, index) => (
              <label className="space-y-1 text-xs text-slate-600" key={`${wordCount}-${index}`}>
                <span>#{index + 1}</span>
                <input
                  aria-label={`Recovery word ${index + 1}`}
                  autoComplete="off"
                  list="bip39-wordlist"
                  onChange={(event) => {
                    const nextFields = [...wordFields];
                    nextFields[index] = event.target.value;
                    setWordFields(nextFields);
                    setError(null);
                  }}
                  value={word}
                />
              </label>
            ))}
          </div>
        </div>
      )}

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
        <button disabled={!hasCompletePhrase} onClick={handleContinue} type="button">
          Continue
        </button>
      </div>
    </section>
  );
}
