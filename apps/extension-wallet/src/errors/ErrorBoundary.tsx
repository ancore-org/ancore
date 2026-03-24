/**
 * ErrorBoundary Component
 *
 * A reusable React ErrorBoundary that wraps the app and catches rendering errors.
 * Uses react-error-boundary library for robust error handling.
 */

import { ErrorBoundary as ReactErrorBoundary, useErrorBoundary } from 'react-error-boundary';
import type { ComponentType, ErrorInfo, JSX, ReactNode } from 'react';
import { ErrorScreen } from './ErrorScreen';
import { ErrorCategory, handleError } from './error-handler';

export interface ErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Fallback component to render on error (optional) */
  fallback?: ReactNode;
  /** Callback when an error is caught */
  onError?: (error: globalThis.Error, errorInfo: ErrorInfo) => void;
  /** Callback when reset is attempted */
  onReset?: () => void;
}

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
export function ErrorBoundary({ children, fallback, onError }: ErrorBoundaryProps): JSX.Element {
  // If there's a custom fallback component provided, use it
  if (fallback) {
    return (
      <ReactErrorBoundary
        fallbackRender={(props) => (
          <ErrorFallback
            error={props.error}
            resetErrorBoundary={props.resetErrorBoundary}
            onError={onError}
            customFallback={fallback}
          />
        )}
      >
        {children}
      </ReactErrorBoundary>
    );
  }

  // Default to ErrorScreen fallback
  return (
    <ReactErrorBoundary
      fallbackRender={(props) => (
        <ErrorFallback
          error={props.error}
          resetErrorBoundary={props.resetErrorBoundary}
          onError={onError}
        />
      )}
    >
      {children}
    </ReactErrorBoundary>
  );
}

/**
 * Props for ErrorFallback component
 */
interface ErrorFallbackProps {
  /** The error that was thrown */
  error: unknown;
  /** Function to reset the error boundary */
  resetErrorBoundary: () => void;
  /** Callback when an error is caught */
  onError?: (error: globalThis.Error, errorInfo: ErrorInfo) => void;
  /** Custom fallback component */
  customFallback?: ReactNode;
}

/**
 * Internal ErrorFallback component that displays the error
 */
function ErrorFallback({
  error,
  resetErrorBoundary,
  onError,
  customFallback,
}: ErrorFallbackProps): JSX.Element {
  // Convert unknown error to Error object
  const err =
    error && typeof error === 'object' && 'message' in error
      ? (error as globalThis.Error)
      : new Error(String(error));

  // Handle the error through our error handler
  const errorInfo = handleError(err, 'React ErrorBoundary');

  // Call onError callback if provided
  if (onError) {
    onError(err, { componentStack: err.stack || '' } as ErrorInfo);
  }

  // If custom fallback is provided, render it
  if (customFallback) {
    return <>{customFallback}</>;
  }

  // Default to ErrorScreen
  return (
    <ErrorScreen
      error={err}
      errorInfo={errorInfo}
      onRetry={resetErrorBoundary}
      onReset={resetErrorBoundary}
    />
  );
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
    dispatch: (error: unknown) => {
      const err =
        error && typeof error === 'object' && 'message' in error
          ? (error as globalThis.Error)
          : new Error(String(error));
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
export function withErrorBoundary<P extends object>(
  Component: ComponentType<P>,
  errorBoundaryProps?: Partial<ErrorBoundaryProps>
): ComponentType<P> {
  return function WrappedComponent(props: P): JSX.Element {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

/**
 * Props for ErrorBoundaryReset component
 */
interface ErrorBoundaryResetProps {
  /** Children to render */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * A button component that resets the ErrorBoundary when clicked
 * Useful for triggering error recovery
 */
export function ErrorBoundaryReset({ children, className }: ErrorBoundaryResetProps): JSX.Element {
  const { reset } = useErrorHandler();

  return (
    <button onClick={reset} className={className} type="button">
      {children || 'Reset'}
    </button>
  );
}

export { ErrorCategory };
export type { ErrorInfo };
