import * as React from 'react';
import { AlertOctagon, RefreshCw, Home, Settings } from 'lucide-react';

export interface ErrorFallbackProps {
  error: Error;
  errorId: string;
  onReset: () => void;
  onGoHome?: () => void;
  onGoToSettings?: () => void;
  onReport?: (errorId: string, sanitizedMessage: string) => void;
}

export function ErrorFallback({
  error,
  errorId,
  onReset,
  onGoHome,
  onGoToSettings,
  onReport,
}: ErrorFallbackProps) {
  // Trigger optional report hook inside useEffect to run exactly once when fallback displays
  React.useEffect(() => {
    onReport?.(errorId, error.message);
  }, [errorId, error.message, onReport]);

  return (
    <div className="flex min-h-screen flex-col bg-background px-6 py-8 text-foreground">
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        {/* Animated outer circle for error icon */}
        <div className="mb-6 rounded-full bg-red-500/10 p-4 ring-8 ring-red-500/5 animate-pulse">
          <AlertOctagon className="h-10 w-10 text-red-500" />
        </div>

        <h1 className="text-xl font-bold tracking-tight text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs leading-relaxed">
          An unexpected rendering error occurred in the extension popup.
        </p>

        {/* Display sanitized error message in a nice muted box */}
        <div className="mt-4 w-full rounded-xl border border-border bg-card p-4 text-left shadow-sm">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
            Error Details
          </span>
          <p className="text-sm font-medium text-foreground break-words leading-normal">
            {error.message}
          </p>
        </div>

        {/* Error ID for support correlation */}
        <div className="mt-4 flex items-center justify-between w-full rounded-lg bg-accent/50 px-3 py-2 border border-border/50">
          <span className="text-xs font-medium text-muted-foreground">Support Reference:</span>
          <span className="font-mono text-xs font-bold text-foreground tracking-wider select-all">
            {errorId}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-auto space-y-3 pt-6 border-t border-border/40">
        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:scale-[1.01] active:scale-[0.99]"
          onClick={onReset}
          type="button"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>

        {onGoHome && (
          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition-all hover:bg-accent hover:scale-[1.01] active:scale-[0.99]"
            onClick={onGoHome}
            type="button"
          >
            <Home className="h-4 w-4" />
            Go to home
          </button>
        )}

        {onGoToSettings && (
          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition-all hover:bg-accent hover:scale-[1.01] active:scale-[0.99]"
            onClick={onGoToSettings}
            type="button"
          >
            <Settings className="h-4 w-4" />
            Go to settings
          </button>
        )}
      </div>
    </div>
  );
}
