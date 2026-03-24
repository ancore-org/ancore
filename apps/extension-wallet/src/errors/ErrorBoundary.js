import { jsx as _jsx, Fragment as _Fragment } from 'react/jsx-runtime';
/**
 * ErrorBoundary Component
 *
 * A reusable React ErrorBoundary that wraps the app and catches rendering errors.
 * Uses react-error-boundary library for robust error handling.
 */
import { ErrorBoundary as ReactErrorBoundary, useErrorBoundary } from 'react-error-boundary';
import { ErrorScreen } from './ErrorScreen';
import { ErrorCategory, handleError } from './error-handler';
/**
 * ErrorBoundary component that catches React rendering errors
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export function ErrorBoundary({ children, fallback, onError }) {
  // If there's a custom fallback component provided, use it
  if (fallback) {
    return _jsx(ReactErrorBoundary, {
      fallbackRender: (props) =>
        _jsx(ErrorFallback, {
          error: props.error,
          resetErrorBoundary: props.resetErrorBoundary,
          onError: onError,
          customFallback: fallback,
        }),
      children: children,
    });
  }
  // Default to ErrorScreen fallback
  return _jsx(ReactErrorBoundary, {
    fallbackRender: (props) =>
      _jsx(ErrorFallback, {
        error: props.error,
        resetErrorBoundary: props.resetErrorBoundary,
        onError: onError,
      }),
    children: children,
  });
}
/**
 * Internal ErrorFallback component that displays the error
 */
function ErrorFallback({ error, resetErrorBoundary, onError, customFallback }) {
  // Convert unknown error to Error object
  const err =
    error && typeof error === 'object' && 'message' in error ? error : new Error(String(error));
  // Handle the error through our error handler
  const errorInfo = handleError(err, 'React ErrorBoundary');
  // Call onError callback if provided
  if (onError) {
    onError(err, { componentStack: err.stack || '' });
  }
  // If custom fallback is provided, render it
  if (customFallback) {
    return _jsx(_Fragment, { children: customFallback });
  }
  // Default to ErrorScreen
  return _jsx(ErrorScreen, {
    error: err,
    errorInfo: errorInfo,
    onRetry: resetErrorBoundary,
    onReset: resetErrorBoundary,
  });
}
/**
 * Hook for handling async errors in components
 * Use this to catch errors in event handlers and async functions
 *
 * @example
 * ```tsx
 * const { reset, dispatch } = useErrorHandler();
 *
 * const handleClick = async () => {
 *   try {
 *     await someAsyncOperation();
 *   } catch (error) {
 *     dispatch(error);
 *   }
 * };
 * ```
 */
export function useErrorHandler() {
  // Use the useErrorBoundary hook to get the error boundary controls
  // Note: This must be used within an ErrorBoundary component
  const { showBoundary, resetBoundary } = useErrorBoundary();
  return {
    /** Dispatch an error to the boundary */
    dispatch: (error) => {
      const err =
        error && typeof error === 'object' && 'message' in error ? error : new Error(String(error));
      showBoundary(err);
    },
    /** Clear the error boundary state */
    reset: () => {
      resetBoundary();
    },
  };
}
/**
 * Higher-order component wrapper for error handling async operations
 *
 * @example
 * ```tsx
 * const WrappedComponent = withErrorBoundary(MyComponent);
 * ```
 */
export function withErrorBoundary(Component, errorBoundaryProps) {
  return function WrappedComponent(props) {
    return _jsx(ErrorBoundary, { ...errorBoundaryProps, children: _jsx(Component, { ...props }) });
  };
}
/**
 * A button component that resets the ErrorBoundary when clicked
 * Useful for triggering error recovery
 */
export function ErrorBoundaryReset({ children, className }) {
  const { reset } = useErrorHandler();
  return _jsx('button', {
    onClick: reset,
    className: className,
    type: 'button',
    children: children || 'Reset',
  });
}
export { ErrorCategory };
//# sourceMappingURL=ErrorBoundary.js.map
