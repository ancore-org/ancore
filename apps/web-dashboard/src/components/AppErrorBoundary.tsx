import React from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Application- and route-level error boundaries (#1348).
 *
 * `WidgetErrorBoundary` isolates individual dashboard widgets, but full pages
 * — Send, Bulk payouts, Scheduled transfers, Reports — had no boundary above
 * them, so a render throw anywhere in a page unmounted the whole React tree.
 * React's default for an uncaught render error is to remove everything,
 * leaving a blank white page with no navigation, no message and nothing to
 * click.
 *
 * Two layers, because one cannot do both jobs:
 *
 *   * **`RouteErrorBoundary`** wraps the routed page inside the dashboard
 *     shell. The chrome survives, so the user still has navigation, and
 *     because it is keyed on the pathname it resets by itself when they
 *     navigate away. This is the layer that actually recovers.
 *   * **`AppErrorBoundary`** wraps everything, including the router and the
 *     auth provider. It catches what the inner layer structurally cannot — a
 *     throw in a provider, in the router itself, or in the shell around the
 *     outlet. It cannot offer a soft retry: re-rendering the same tree that
 *     just threw reproduces the throw, so it offers a reload.
 */

function isDevelopment(): boolean {
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

/**
 * Report a crash.
 *
 * Deliberately logs the error's name and message but not the whole object:
 * this app handles addresses and transaction payloads, and a thrown error can
 * carry them in fields that end up in an aggregator. The component stack is
 * safe and is the part that actually locates the fault.
 */
export function logAppError(error: Error, info: { componentStack?: string | null }): void {
  console.error('[App Error Boundary] Uncaught render error:', {
    name: error.name,
    message: error.message,
  });
  if (info.componentStack) {
    console.error('[App Error Boundary] Component stack:', info.componentStack);
  }
}

const ErrorShell: React.FC<{
  title: string;
  description: string;
  error: Error;
  action: React.ReactNode;
}> = ({ title, description, error, action }) => (
  <main
    role="alert"
    aria-labelledby="app-error-title"
    className="flex min-h-[60vh] items-center justify-center p-6"
  >
    <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-5 w-5 text-destructive" />
      </span>
      <h1 id="app-error-title" className="mt-4 text-lg font-semibold">
        {title}
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>

      {/* The raw message is useful while developing and noise-or-worse in
          production, where it can leak internals into a screenshot. */}
      {isDevelopment() && (
        <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-muted p-3 text-left text-xs text-muted-foreground">
          {error.message}
        </pre>
      )}

      <div className="mt-5 flex justify-center">{action}</div>
    </section>
  </main>
);

const buttonClass =
  'inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98]';

const AppErrorFallback: React.FC<FallbackProps> = ({ error }) => (
  <ErrorShell
    title="Something went wrong"
    description="The dashboard hit an unexpected error and could not continue. Reloading usually clears it."
    error={error as Error}
    action={
      <button type="button" className={buttonClass} onClick={() => window.location.reload()}>
        <RefreshCw className="h-4 w-4" />
        Reload the dashboard
      </button>
    }
  />
);

const RouteErrorFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => (
  <ErrorShell
    title="This page could not be displayed"
    description="The rest of the dashboard is still available — use the navigation, or try this page again."
    error={error as Error}
    action={
      <button type="button" className={buttonClass} onClick={resetErrorBoundary}>
        <RefreshCw className="h-4 w-4" />
        Try again
      </button>
    }
  />
);

/**
 * Outermost boundary. Wrap the whole app, above the router and providers.
 */
export const AppErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary FallbackComponent={AppErrorFallback} onError={logAppError}>
    {children}
  </ErrorBoundary>
);

/**
 * Per-route boundary. Wrap the routed content inside the dashboard shell.
 *
 * Keyed on the pathname so navigating away clears a crashed page without the
 * user having to press anything — otherwise the fallback would persist across
 * navigation and the nav links would appear broken.
 */
export const RouteErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  return (
    <ErrorBoundary
      key={location.pathname}
      FallbackComponent={RouteErrorFallback}
      onError={logAppError}
    >
      {children}
    </ErrorBoundary>
  );
};
