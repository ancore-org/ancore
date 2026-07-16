import { ChevronRight, Download, Plus, HelpCircle } from 'lucide-react';

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
      iconClass: 'bg-emerald-500 text-white',
      title: 'Create new wallet',
      description: 'Generate a new recovery phrase and smart account on Stellar.',
      onClick: onNext,
    },
    {
      key: 'import',
      icon: Download,
      iconClass: 'bg-sky-500 text-white',
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
          <span className="text-xl leading-none">×</span>
        </button>
        <button type="button" className="wallet-icon-btn" aria-label="Help">
          <HelpCircle className="h-5 w-5 text-muted-foreground" />
        </button>
      </header>

      <div className="flex flex-1 flex-col px-6 pb-8 pt-4">
        {/* Soft stacked-card illustration */}
        <div className="mb-8 flex justify-center" aria-hidden="true">
          <div className="relative h-28 w-40">
            <div className="absolute left-1/2 top-0 h-20 w-36 -translate-x-1/2 rounded-2xl bg-emerald-500/90" />
            <div className="absolute left-1/2 top-3 h-20 w-36 -translate-x-1/2 rounded-2xl bg-amber-400/90" />
            <div className="absolute left-1/2 top-6 flex h-20 w-36 -translate-x-1/2 items-center justify-between rounded-2xl bg-sky-500 px-4 shadow-lg">
              <div className="h-8 w-8 rounded-full bg-white/30" />
              <div className="h-2 w-12 rounded-full bg-white/40" />
            </div>
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
            className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-200"
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
              <span className={`wallet-option-icon ${opt.iconClass}`}>
                <opt.icon className="h-5 w-5" strokeWidth={2.25} />
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
