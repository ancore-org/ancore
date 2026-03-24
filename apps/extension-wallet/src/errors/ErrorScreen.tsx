/**
 * ErrorScreen Component
 *
 * Displays user-friendly error messages with recovery options
 * (retry or reset). Used by ErrorBoundary as the fallback UI.
 */

import { Button } from '@ancore/ui-kit';
import { AlertTriangle, RotateCcw, RefreshCw, Info } from 'lucide-react';
import { ReactNode } from 'react';
import { getErrorMessage, ErrorCategory } from './error-messages';
import { ErrorInfo, handleError } from './error-handler';

export interface ErrorScreenProps {
  /** The error that was thrown */
  error?: globalThis.Error;
  /** Processed error information from the error handler */
  errorInfo?: ErrorInfo;
  /** Callback when retry is clicked */
  onRetry?: () => void;
  /** Callback when reset is clicked */
  onReset?: () => void;
  /** Custom title override */
  title?: string;
  /** Custom description override */
  description?: string;
  /** Additional content to render */
  children?: ReactNode;
  /** Show technical details (error message, stack) */
  showDetails?: boolean;
  /** CSS class name */
  className?: string;
}

/**
 * ErrorScreen displays a user-friendly error page with recovery options
 *
 * @example
 * ```tsx
 * <ErrorScreen
 *   error={error}
 *   errorInfo={errorInfo}
 *   onRetry={() => refetch()}
 * />
 * ```
 */
export function ErrorScreen({
  error,
  errorInfo,
  onRetry,
  onReset,
  title,
  description,
  children,
  showDetails = false,
  className,
}: ErrorScreenProps): JSX.Element {
  // Get user-friendly message from error info or fall back to defaults
  const userMessage = errorInfo
    ? getErrorMessage(errorInfo.category, errorInfo.code)
    : getErrorMessage(ErrorCategory.UNKNOWN);

  // Display title (custom or from message)
  const displayTitle = title || userMessage.title;
  const displayDescription = description || userMessage.description;

  return (
    <div className={className}>
      {/* Main error display card */}
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full">
          {/* Error icon */}
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full">
              <AlertTriangle className="w-12 h-12 text-red-600 dark:text-red-400" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
            {displayTitle}
          </h1>

          {/* Description */}
          <p className="text-center text-gray-600 dark:text-gray-300 mb-6">{displayDescription}</p>

          {/* Recovery hint */}
          {userMessage.recoveryHint && (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-6 italic">
              {userMessage.recoveryHint}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {/* Retry button */}
            {userMessage.canRetry && onRetry && (
              <Button
                onClick={onRetry}
                variant="default"
                className="flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
            )}

            {/* Reset button */}
            {userMessage.canReset && onReset && (
              <Button
                onClick={onReset}
                variant="outline"
                className="flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </Button>
            )}

            {/* Custom retry for non-recoverable errors */}
            {!userMessage.canRetry && onRetry && (
              <Button
                onClick={onRetry}
                variant="default"
                className="flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
            )}
          </div>

          {/* Technical details (collapsible) */}
          {showDetails && (
            <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <details className="cursor-pointer">
                <summary className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                  <Info className="w-4 h-4" />
                  Technical Details
                </summary>
                <div className="mt-3 text-xs font-mono text-gray-600 dark:text-gray-400 overflow-auto max-h-48">
                  <p className="mb-2">
                    <strong>Error:</strong> {error?.message || 'Unknown error'}
                  </p>
                  {error?.stack && <p className="whitespace-pre-wrap">{error.stack}</p>}
                </div>
              </details>
            </div>
          )}

          {/* Additional children content */}
          {children && <div className="mt-6">{children}</div>}
        </div>
      </div>
    </div>
  );
}

/**
 * Props for ErrorCard component (inline error display)
 */
interface ErrorCardProps {
  /** Error message to display */
  message: string;
  /** Optional callback for retry */
  onRetry?: () => void;
  /** Error severity level */
  variant?: 'error' | 'warning' | 'info';
  /** CSS class name */
  className?: string;
}

/**
 * ErrorCard - A compact inline error display component
 * Use this for inline errors within forms or smaller contexts
 *
 * @example
 * ```tsx
 * <ErrorCard
 *   message="Failed to load data"
 *   onRetry={refetch}
 * />
 * ```
 */
export function ErrorCard({
  message,
  onRetry,
  variant = 'error',
  className,
}: ErrorCardProps): JSX.Element {
  const variantStyles = {
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  };

  const iconColor = {
    error: 'text-red-600 dark:text-red-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    info: 'text-blue-600 dark:text-blue-400',
  };

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-lg border
        ${variantStyles[variant]}
        ${className || ''}
      `}
    >
      <AlertTriangle className={`w-5 h-5 mt-0.5 ${iconColor[variant]}`} />
      <div className="flex-1">
        <p className="text-sm text-gray-700 dark:text-gray-300">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/**
 * Props for AsyncErrorHandler component
 */
interface AsyncErrorHandlerProps {
  /** The error that occurred */
  error: unknown;
  /** Callback to retry the async operation */
  onRetry?: () => void;
  /** Callback to reset the component state */
  onReset?: () => void;
  /** Whether to show compact mode */
  compact?: boolean;
}

/**
 * AsyncErrorHandler - Handles errors from async operations
 * Use this in components that perform async operations
 *
 * @example
 * ```tsx
 * const { data, error, refetch } = useQuery();
 *
 * if (error) {
 *   return (
 *     <AsyncErrorHandler
 *       error={error}
 *       onRetry={refetch}
 *     />
 *   );
 * }
 * ```
 */
export function AsyncErrorHandler({
  error,
  onRetry,
  onReset,
  compact = false,
}: AsyncErrorHandlerProps): JSX.Element {
  // Handle the error through our error handler
  const errorInfo = handleError(error, 'Async operation');
  const userMessage = getErrorMessage(errorInfo.category, errorInfo.code);

  if (compact) {
    return <ErrorCard message={userMessage.description} onRetry={onRetry} variant="error" />;
  }

  return (
    <ErrorScreen
      error={
        error && typeof error === 'object' && 'message' in error
          ? (error as globalThis.Error)
          : new Error(String(error))
      }
      errorInfo={errorInfo}
      onRetry={onRetry}
      onReset={onReset}
    />
  );
}

// Re-export for convenience
export { handleError } from './error-handler';
