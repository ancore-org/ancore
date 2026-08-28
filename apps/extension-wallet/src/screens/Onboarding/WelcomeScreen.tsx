import { ChevronRight, Download, Plus, HelpCircle, WalletCards, X } from 'lucide-react';

/**
 * Welcome screen props
 */
export interface WelcomeScreenProps {
  onNext: () => void | Promise<void>;
  onImport?: () => void;
  onBack?: () => void;
  /** Shown when create-wallet fails (e.g. crypto error). */
  error?: string | null;
  /** True while mnemonic generation is in flight. */
  isLoading?: boolean;
}

/**
 * WelcomeScreen — first-run chooser.
 * Visual language: clean option list (ref: “Add an Existing Wallet”).
 * Stellar product copy; no ETH/iCloud-specific paths.
 */
export function WelcomeScreen({
  onNext,
  onImport,
  onBack,
  error,
  isLoading = false,
}: WelcomeScreenProps) {
  const options = [
    {
      key: 'create',
      icon: Plus,
      title: 'Create new wallet',
      description: 'Generate a new recovery phrase and smart account on Stellar.',
      onClick: onNext,
    },
    {
      key: 'import',
      icon: Download,
      title: 'Import',
      description: 'Add an existing wallet with a 12 or 24-word recovery phrase.',
      onClick: onImport,
      disabled: !onImport,
    },
  ] as const;

  return (
    <div className="wallet-sheet">
      <header className="wallet-header">
        <button
          type="button"
          className="wallet-icon-btn"
          aria-label="Close"
          onClick={onBack}
          disabled={!onBack}
        >
          <X className="h-5 w-5" />
        </button>
        <button type="button" className="wallet-icon-btn" aria-label="Help">
          <HelpCircle className="h-5 w-5 text-muted-foreground" />
        </button>
      </header>

      <div className="flex flex-1 flex-col px-6 pb-8 pt-4">
        <div className="mb-8 flex justify-center" aria-hidden="true">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground text-background">
            <WalletCards className="h-5 w-5" strokeWidth={2} />
          </div>
        </div>

        <div className="mb-8 text-center">
          <h1 className="mb-2 text-[26px] font-semibold tracking-tight text-foreground">
            Set up your wallet
          </h1>
          <p className="mx-auto max-w-[280px] text-[15px] leading-relaxed text-muted-foreground">
            Create a new smart account or continue with one you already own.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="wallet-status-error mb-4 rounded-2xl border px-4 py-3 text-[13px]"
          >
            {error}
          </div>
        )}

        {isLoading && (
          <div className="mb-4 flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            Generating recovery phrase…
          </div>
        )}

        <div className="flex flex-col gap-3">
          {options.map((opt) => (
            <button
              key={opt.key}
              type="button"
              disabled={isLoading || ('disabled' in opt && opt.disabled)}
              onClick={() => void opt.onClick?.()}
              className="wallet-option-row disabled:opacity-40"
            >
              <span className="wallet-option-icon">
                <opt.icon className="h-5 w-5" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold text-foreground">{opt.title}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
                  {opt.description}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/70" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
