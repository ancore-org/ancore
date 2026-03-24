import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
/**
 * ErrorScreen Component
 *
 * Displays user-friendly error messages with recovery options
 * (retry or reset). Used by ErrorBoundary as the fallback UI.
 */
import { Button } from '@ancore/ui-kit';
import { AlertTriangle, RotateCcw, RefreshCw, Info } from 'lucide-react';
import { getErrorMessage, ErrorCategory } from './error-messages';
import { handleError } from './error-handler';
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
}) {
  // Get user-friendly message from error info or fall back to defaults
  const userMessage = errorInfo
    ? getErrorMessage(errorInfo.category, errorInfo.code)
    : getErrorMessage(ErrorCategory.UNKNOWN);
  // Display title (custom or from message)
  const displayTitle = title || userMessage.title;
  const displayDescription = description || userMessage.description;
  return _jsx('div', {
    className: className,
    children: _jsx('div', {
      className:
        'flex flex-col items-center justify-center min-h-[400px] p-8 bg-gray-50 dark:bg-gray-900',
      children: _jsxs('div', {
        className: 'max-w-md w-full',
        children: [
          _jsx('div', {
            className: 'flex justify-center mb-6',
            children: _jsx('div', {
              className: 'p-4 bg-red-100 dark:bg-red-900/30 rounded-full',
              children: _jsx(AlertTriangle, {
                className: 'w-12 h-12 text-red-600 dark:text-red-400',
              }),
            }),
          }),
          _jsx('h1', {
            className: 'text-2xl font-bold text-center text-gray-900 dark:text-white mb-2',
            children: displayTitle,
          }),
          _jsx('p', {
            className: 'text-center text-gray-600 dark:text-gray-300 mb-6',
            children: displayDescription,
          }),
          userMessage.recoveryHint &&
            _jsx('p', {
              className: 'text-center text-sm text-gray-500 dark:text-gray-400 mb-6 italic',
              children: userMessage.recoveryHint,
            }),
          _jsxs('div', {
            className: 'flex flex-col sm:flex-row gap-3 justify-center',
            children: [
              userMessage.canRetry &&
                onRetry &&
                _jsxs(Button, {
                  onClick: onRetry,
                  variant: 'default',
                  className: 'flex items-center justify-center gap-2',
                  children: [_jsx(RefreshCw, { className: 'w-4 h-4' }), 'Try Again'],
                }),
              userMessage.canReset &&
                onReset &&
                _jsxs(Button, {
                  onClick: onReset,
                  variant: 'outline',
                  className: 'flex items-center justify-center gap-2',
                  children: [_jsx(RotateCcw, { className: 'w-4 h-4' }), 'Reset'],
                }),
              !userMessage.canRetry &&
                onRetry &&
                _jsxs(Button, {
                  onClick: onRetry,
                  variant: 'default',
                  className: 'flex items-center justify-center gap-2',
                  children: [_jsx(RefreshCw, { className: 'w-4 h-4' }), 'Try Again'],
                }),
            ],
          }),
          showDetails &&
            _jsx('div', {
              className: 'mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg',
              children: _jsxs('details', {
                className: 'cursor-pointer',
                children: [
                  _jsxs('summary', {
                    className:
                      'flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white',
                    children: [_jsx(Info, { className: 'w-4 h-4' }), 'Technical Details'],
                  }),
                  _jsxs('div', {
                    className:
                      'mt-3 text-xs font-mono text-gray-600 dark:text-gray-400 overflow-auto max-h-48',
                    children: [
                      _jsxs('p', {
                        className: 'mb-2',
                        children: [
                          _jsx('strong', { children: 'Error:' }),
                          ' ',
                          error?.message || 'Unknown error',
                        ],
                      }),
                      error?.stack &&
                        _jsx('p', { className: 'whitespace-pre-wrap', children: error.stack }),
                    ],
                  }),
                ],
              }),
            }),
          children && _jsx('div', { className: 'mt-6', children: children }),
        ],
      }),
    }),
  });
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
export function ErrorCard({ message, onRetry, variant = 'error', className }) {
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
  return _jsxs('div', {
    className: `
        flex items-start gap-3 p-4 rounded-lg border
        ${variantStyles[variant]}
        ${className || ''}
      `,
    children: [
      _jsx(AlertTriangle, { className: `w-5 h-5 mt-0.5 ${iconColor[variant]}` }),
      _jsx('div', {
        className: 'flex-1',
        children: _jsx('p', {
          className: 'text-sm text-gray-700 dark:text-gray-300',
          children: message,
        }),
      }),
      onRetry &&
        _jsx('button', {
          onClick: onRetry,
          className:
            'text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white',
          children: _jsx(RotateCcw, { className: 'w-4 h-4' }),
        }),
    ],
  });
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
export function AsyncErrorHandler({ error, onRetry, onReset, compact = false }) {
  // Handle the error through our error handler
  const errorInfo = handleError(error, 'Async operation');
  const userMessage = getErrorMessage(errorInfo.category, errorInfo.code);
  if (compact) {
    return _jsx(ErrorCard, {
      message: userMessage.description,
      onRetry: onRetry,
      variant: 'error',
    });
  }
  return _jsx(ErrorScreen, {
    error:
      error && typeof error === 'object' && 'message' in error ? error : new Error(String(error)),
    errorInfo: errorInfo,
    onRetry: onRetry,
    onReset: onReset,
  });
}
// Re-export for convenience
export { handleError } from './error-handler';
//# sourceMappingURL=ErrorScreen.js.map
